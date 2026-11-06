import {spawn} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {homedir} from 'node:os'
import {join,isAbsolute} from 'node:path'
import {readFile,mkdir,lstat,open,rename,unlink} from 'node:fs/promises'
import {readMorkahjaContentConfig} from './morkahjaContentConfig.mjs'
import {buildContentSshArgs} from './morkahjaContentRunner.mjs'
import {imageRequest} from './morkahjaImages.mjs'

const MAX_IMAGE=2*1024*1024
const MAX_LINE=3*1024*1024
const MAX_FILES=50000
const RECHECK_MS=10*60*1000
const MAX_SYNC_MS=12*60*1000
const kinds=new Set(['encounter','solution','expansion','frame','portrait'])

function defaultCacheRoot() {
  const configured=process.env.XDG_CACHE_HOME
  const base=configured && isAbsolute(configured)?configured:join(homedir(),'.cache')
  return join(base,'babuni-admin','morkahja-images')
}

function validEntry(key,meta) {
  const slash=key.indexOf('/')
  if(slash<0)return false
  try{imageRequest({kind:key.slice(0,slash),name:key.slice(slash+1)})}
  catch{return false}
  return !!meta && typeof meta==='object' && !Array.isArray(meta) &&
    Object.keys(meta).sort().join(',')==='mtimeNs,size' &&
    Number.isSafeInteger(meta.size) && meta.size>0 && meta.size<=MAX_IMAGE &&
    typeof meta.mtimeNs==='string' && /^[0-9]{1,22}$/.test(meta.mtimeNs)
}
function webp(bytes) {
  return bytes.length>=12 && bytes.length<=MAX_IMAGE &&
    bytes.toString('ascii',0,4)==='RIFF' &&
    bytes.toString('ascii',8,12)==='WEBP'
}
function folderFor(root,profile) {
  const identity=String(profile.id)+':'+String(profile.target)+':'+String(profile.kind)
  return join(root,createHash('sha256').update(identity).digest('hex'))
}
async function safeFile(path) {
  try {
    const info=await lstat(path)
    return info.isFile() && !info.isSymbolicLink() && info.size>0 && info.size<=MAX_IMAGE
  }catch{return false}
}
async function atomicWrite(path,bytes) {
  const temp=path+'.'+randomUUID()+'.tmp'
  try {
    const file=await open(temp,'wx',0o600)
    try{await file.writeFile(bytes)}finally{await file.close()}
    await rename(temp,path)
  }finally{await unlink(temp).catch(()=>{})}
}
async function loadPrevious(folder) {
  try {
    const path=join(folder,'manifest.json')
    const info=await lstat(path)
    if(!info.isFile()||info.isSymbolicLink()||info.size>6*1024*1024)return {}
    const parsed=JSON.parse(await readFile(path,'utf8'))
    if(!parsed || parsed.version!==1 || !parsed.files ||
       typeof parsed.files!=='object' || Array.isArray(parsed.files))return {}
    const kept={}
    for(const [key,meta] of Object.entries(parsed.files).slice(0,MAX_FILES)) {
      if(!validEntry(key,meta))continue
      const [kind,name]=key.split('/')
      if(await safeFile(join(folder,kind,name)))kept[key]=meta
    }
    return kept
  }catch{return {}}
}
async function saveManifest(folder,entries) {
  await atomicWrite(join(folder,'manifest.json'),
    Buffer.from(JSON.stringify({version:1,files:entries}), 'utf8'))
}
function childEnv() {
  const result={}
  for(const name of ['PATH','HOME','USER','LOGNAME','LANG','SSH_AUTH_SOCK','XDG_RUNTIME_DIR'])
    if(typeof process.env[name]==='string')result[name]=process.env[name]
  result.SSH_ASKPASS_REQUIRE='never'
  result.SSH_ASKPASS='/bin/false'
  return result
}
function publicStatus(status) {
  return {
    phase:status.phase,
    cached:status.cached,
    verified:status.verified,
    downloaded:status.downloaded,
    count:status.count,
    updatedAt:status.updatedAt,
    error:status.error,
    generation:status.generation,
  }
}

export function createMorkahjaImageCache({
  root=defaultCacheRoot(),approve=readMorkahjaContentConfig,startSsh=spawn,
  readWorker=()=>readFile(new URL('../scripts/morkahja-image-cache-sync.py',import.meta.url),'utf8'),
}={}) {
  const states=new Map()
  const children=new Set()
  const profileKey=profile=>String(profile.id)+':'+String(profile.target)+':'+String(profile.kind)
  function stateFor(profile) {
    const key=profileKey(profile)
    if(!states.has(key))states.set(key,{
      phase:'idle',cached:0,verified:0,downloaded:0,count:0,
      updatedAt:null,error:null,generation:0,lastAttempt:0,promise:null,
    })
    return states.get(key)
  }

  async function sync(profile,status) {
    const folder=folderFor(root,profile)
    await mkdir(folder,{recursive:true,mode:0o700})
    const previous=await loadPrevious(folder)
    status.cached=Object.keys(previous).length
    const approved=await approve(profile)
    if(!approved.ok)throw new Error(approved.code)
    const source=await readWorker()
    const input='CACHED_JSON='+JSON.stringify(JSON.stringify(previous))+'\n'+source+'\n'
    const next={}
    const unavailable=new Set()
    const missingFolders=new Set()
    let completed=false,exitError=null,closeCode=null,closeSignal=null
    const child=startSsh('ssh',buildContentSshArgs(approved.config),{
      shell:false,stdio:['pipe','pipe','pipe'],env:childEnv(),
    })
    children.add(child)
    const timer=setTimeout(()=>child.kill('SIGKILL'),MAX_SYNC_MS)
    const closed=new Promise(resolve=>{
      child.on('close',(code,signal)=>{closeCode=code;closeSignal=signal;resolve()})
      child.on('error',error=>{exitError=error;resolve()})
    })
    let stderr=''
    child.stderr?.on('data',data=>{
      stderr=(stderr+String(data)).slice(-512)
    })
    child.stdin?.on('error',()=>{})
    child.stdin?.end(input)

    async function record(line) {
      const item=JSON.parse(line)
      if(!item||typeof item!=='object')throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
      if(item.type==='complete') {
        if(!Number.isSafeInteger(item.count) || item.count<0 || item.count>MAX_FILES)
          throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
        completed=true
        status.count=item.count
        return
      }
      if(item.type==='error')throw new Error('IMAGE_SYNC_REMOTE_FAILED')
      if(item.type==='folder-unavailable' && kinds.has(item.kind)) {
        missingFolders.add(item.kind)
        return
      }
      if(!['file','keep','unavailable'].includes(item.type))
        throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
      imageRequest({kind:item.kind,name:item.name})
      const key=item.kind+'/'+item.name
      if(item.type==='unavailable') {
        unavailable.add(key)
        return
      }
      if(!validEntry(key,item.meta))throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
      if(item.type==='keep' && JSON.stringify(previous[key])!==JSON.stringify(item.meta))
        throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
      if(item.type==='file') {
        if(typeof item.base64!=='string' || item.base64.length>MAX_LINE ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(item.base64))
          throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
        const bytes=Buffer.from(item.base64,'base64')
        if(!webp(bytes)||bytes.length!==item.meta.size)
          throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
        const subdir=join(folder,item.kind)
        await mkdir(subdir,{recursive:true,mode:0o700})
        await atomicWrite(join(subdir,item.name),bytes)
        status.downloaded++
      }
      next[key]=item.meta
      status.verified++
      if(status.downloaded && status.downloaded%64===0 && item.type==='file')
        await saveManifest(folder,{...previous,...next})
    }
    try {
      let pending=''
      for await(const part of child.stdout) {
        pending+=part.toString('utf8')
        if(pending.length>MAX_LINE+2048)throw new Error('IMAGE_SYNC_TOO_LARGE')
        let end
        while((end=pending.indexOf('\n'))!==-1) {
          const line=pending.slice(0,end)
          pending=pending.slice(end+1)
          if(line)await record(line)
          if(completed && pending.trim())throw new Error('IMAGE_SYNC_INVALID_RESPONSE')
        }
      }
      await closed
      if(exitError||closeCode!==0||closeSignal||!completed||pending.trim())
        throw new Error('IMAGE_SYNC_SSH_FAILED')
      // Retain stale cached images if a remote folder could not be inspected
      // or if an individual remote file could not be read.
      for(const [key,meta] of Object.entries(previous)) {
        if(missingFolders.has(key.split('/')[0]) || unavailable.has(key))
          next[key]=meta
      }
      let removed=0
      for(const key of Object.keys(previous)) {
        if(Object.hasOwn(next,key))continue
        removed++
        const [kind,name]=key.split('/')
        await unlink(join(folder,kind,name)).catch(()=>{})
      }
      await saveManifest(folder,next)
      status.cached=Object.keys(next).length
      status.updatedAt=new Date().toISOString()
      if(status.downloaded>0||removed>0)status.generation++
      status.phase='ready'
      status.error=missingFolders.size?
        'Some remote image folders were unavailable; existing cached images were kept.':null
    }catch(error) {
      child.kill('SIGKILL')
      throw error
    }finally {
      clearTimeout(timer)
      children.delete(child)
    }
  }

  function ensureSync(profile) {
    const status=stateFor(profile)
    if(status.phase==='syncing')return publicStatus(status)
    if(status.phase==='ready' && Date.now()-status.lastAttempt<RECHECK_MS)
      return publicStatus(status)
    status.phase='syncing'
    status.error=null
    status.verified=0
    status.downloaded=0
    status.count=0
    status.lastAttempt=Date.now()
    status.promise=sync(profile,status).catch(error=>{
      status.phase='failed'
      status.error=error instanceof Error?error.message:'IMAGE_SYNC_FAILED'
    }).finally(()=>{status.promise=null})
    return publicStatus(status)
  }

  async function readCached(profile,request) {
    let requested
    try{requested=imageRequest(request)}
    catch{return {ok:false,code:'INVALID_IMAGE_REQUEST'}}
    const folder=folderFor(root,profile)
    const path=join(folder,requested.kind,requested.name)
    if(await safeFile(path)) {
      try {
        const data=await readFile(path)
        if(webp(data))return {ok:true,base64:data.toString('base64'),contentType:'image/webp'}
      }catch { /* A missing or replaced cache file is treated as a miss. */ }
    }
    const status=stateFor(profile)
    return {ok:false,code:status.phase==='syncing'?'IMAGE_CACHE_PENDING':'IMAGE_UNAVAILABLE'}
  }
  function status(profile) {return publicStatus(stateFor(profile))}
  async function stop() {
    for(const child of children)child.kill('SIGKILL')
    await Promise.allSettled([...states.values()].map(state=>state.promise).filter(Boolean))
  }
  return {ensureSync,readCached,status,stop}
}

export const morkahjaImageCache=createMorkahjaImageCache()
