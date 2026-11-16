import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {readMorkahjaContentConfig} from './morkahjaContentConfig.mjs'
import {buildContentSshArgs} from './morkahjaContentRunner.mjs'

// Writes one WebP into a fixed Morkahja image folder on the live server, then
// checks that players can download exactly those bytes from the public URL.
export const IMAGE_FOLDERS=Object.freeze({
  encounter:'game/encounterimages',
  solution:'game/solutionimages',
  expansion:'UI/03_DASHBOARD/expansions',
  frame:'UI/02_AvatarCreation/Frames',
  portrait:'UI/02_AvatarCreation/Avatare',
})
export const PUBLIC_GAME_BASE='https://www.babuni.dev/Morkahja/'
const MAX_IMAGE=2*1024*1024
const baseNamePattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,109}$/
let active=false
export const isImageWriteActive=()=>active

const webp=bytes=>bytes.length>=12 && bytes.length<=MAX_IMAGE &&
  bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP'

/** `exact` writes or replaces that name; `unique` adds 2_, 3_… if the name is taken. */
export function imageWriteRequest(value) {
  if(!value||typeof value!=='object'||Array.isArray(value) ||
    Object.keys(value).sort().join(',')!=='base64,kind,mode,name' ||
    !Object.hasOwn(IMAGE_FOLDERS,value.kind) || !['exact','unique'].includes(value.mode) ||
    typeof value.name!=='string' || typeof value.base64!=='string' ||
    value.base64.length>Math.ceil(MAX_IMAGE/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.base64))
    throw new Error('INVALID_IMAGE_REQUEST')
  const base=value.name.replace(/\.webp$/i,'')
  if(!baseNamePattern.test(base))throw new Error('INVALID_IMAGE_NAME')
  const bytes=Buffer.from(value.base64,'base64')
  if(!webp(bytes))throw new Error('IMAGE_NOT_WEBP')
  return {kind:value.kind,mode:value.mode,base,bytes}
}

export async function runImageWriteSsh(config,request,{start=spawn,readWorker}={}) {
  const source=await (readWorker||(()=>readFile(
    new URL('../scripts/morkahja-image-write-worker.py',import.meta.url),'utf8')))()
  const payload=Buffer.from(JSON.stringify({
    kind:request.kind,mode:request.mode,base:request.base,
    data:request.bytes.toString('base64'),
  }),'utf8').toString('base64')
  return new Promise(resolve=>{
    const child=start('ssh',buildContentSshArgs(config),{
      shell:false,stdio:['pipe','pipe','pipe'],
      env:{...Object.fromEntries(
        ['PATH','HOME','USER','LOGNAME','LANG','SSH_AUTH_SOCK','XDG_RUNTIME_DIR']
          .filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]])),
      SSH_ASKPASS_REQUIRE:'never',SSH_ASKPASS:'/bin/false'},
    })
    let output='',finished=false,timedOut=false
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},30000)
    const done=result=>{if(finished)return;finished=true;clearTimeout(timer);resolve(result)}
    child.on('error',()=>done({ok:false,code:'IMAGE_SSH_FAILED'}))
    child.stdout?.on('data',chunk=>{if(output.length<8192)output+=chunk.toString('utf8')})
    child.on('close',(code,signal)=>{
      if(timedOut)return done({ok:false,code:'IMAGE_TIMEOUT'})
      if(code!==0||signal)return done({ok:false,code:'IMAGE_SSH_FAILED'})
      let data
      try{data=JSON.parse(output)}catch{return done({ok:false,code:'IMAGE_INVALID_RESPONSE'})}
      if(!data?.ok)return done({ok:false,code:typeof data?.code==='string' &&
        /^IMAGE_[A-Z_]{1,40}$/.test(data.code)?data.code:'IMAGE_WRITE_FAILED'})
      if(typeof data.name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}\.webp$/.test(data.name) ||
        typeof data.sha256!=='string'||!/^[0-9a-f]{64}$/.test(data.sha256) ||
        typeof data.replaced!=='boolean')
        return done({ok:false,code:'IMAGE_INVALID_RESPONSE'})
      done({ok:true,name:data.name,sha256:data.sha256,replaced:data.replaced})
    })
    child.stdin?.on('error',()=>{})
    try{child.stdin?.end("REQUEST_BASE64 = '"+payload+"'\n"+source+'\n')}
    catch{child.kill('SIGKILL');done({ok:false,code:'IMAGE_SSH_FAILED'})}
  })
}

/** Downloads the image the way a player would and compares the bytes. */
export async function checkPublicImage(kind,name,sha256,{fetchImpl=fetch}={}) {
  const url=PUBLIC_GAME_BASE+IMAGE_FOLDERS[kind]+'/'+name
  try {
    const response=await fetchImpl(url+'?v='+sha256.slice(0,12),{
      cache:'no-store',signal:AbortSignal.timeout(10000),
    })
    if(!response.ok)return {url,ok:false,status:response.status}
    const bytes=Buffer.from(await response.arrayBuffer())
    const actual=createHash('sha256').update(bytes).digest('hex')
    return {url,ok:actual===sha256,status:response.status}
  }catch{return {url,ok:false,status:0}}
}

export async function writeMorkahjaImage(profile,value,deps={}) {
  let request
  try{request=imageWriteRequest(value)}catch(error){return {ok:false,code:error.message}}
  if(active)return {ok:false,code:'IMAGE_WRITE_BUSY'}
  active=true
  try {
    const approved=await (deps.readConfig||readMorkahjaContentConfig)(profile)
    if(!approved.ok)return {ok:false,code:approved.code}
    const written=await (deps.run||runImageWriteSsh)(approved.config,request)
    if(!written.ok)return written
    const expected=createHash('sha256').update(request.bytes).digest('hex')
    if(written.sha256!==expected)return {ok:false,code:'IMAGE_WRITE_VERIFY_FAILED'}
    const publicCheck=await (deps.checkPublic||checkPublicImage)(request.kind,written.name,expected)
    return {ok:true,kind:request.kind,name:written.name,sha256:expected,
      size:request.bytes.length,replaced:written.replaced,bytes:request.bytes,publicCheck}
  }catch{return {ok:false,code:'IMAGE_WRITE_FAILED'}}
  finally{active=false}
}
