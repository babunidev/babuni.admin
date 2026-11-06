import {spawn} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {readMorkahjaContentConfig} from './morkahjaContentConfig.mjs'
import {sshKnownHostsPath} from './sshHostPreflight.mjs'
import {classifySshExitDiagnostic} from './sshTunnel.mjs'

const KINDS=new Set(['encounters','solutions','expansions','frames','portraits'])
const MAX_REQUEST=128*1024
const MAX_RESPONSE=10*1024*1024
let active=false
export const isContentActive=()=>active

export function validateContentRequest(request) {
  if(!request || typeof request!=='object' || Array.isArray(request) ||
    !KINDS.has(request.kind) || !['read','write'].includes(request.action)) {
    throw new Error('CONTENT_INVALID_REQUEST')
  }
  if(request.action==='read') {
    if(Object.keys(request).sort().join(',')!=='action,kind')
      throw new Error('CONTENT_INVALID_REQUEST')
  } else {
    if(Object.keys(request).sort().join(',')!=='action,data,expectedRevision,key,kind' ||
      !/^[0-9a-f]{64}$/.test(request.expectedRevision) ||
      !request.data || typeof request.data!=='object' || Array.isArray(request.data) ||
      !(typeof request.key==='string' && /^[A-Za-z0-9_-]{1,100}$/.test(request.key) ||
        Number.isInteger(request.key) && request.key>=0 && request.key<=10000)) {
      throw new Error('CONTENT_INVALID_REQUEST')
    }
  }
  if(Buffer.byteLength(JSON.stringify(request),'utf8')>MAX_REQUEST)
    throw new Error('CONTENT_TOO_LARGE')
  return request
}

export function buildContentSshArgs(config) {
  return ['-F','/dev/null','-T',
    '-o','BatchMode=yes','-o','NumberOfPasswordPrompts=0',
    '-o','StrictHostKeyChecking=yes',
    '-o','UserKnownHostsFile='+sshKnownHostsPath(),
    '-o','GlobalKnownHostsFile=/dev/null','-o','UpdateHostKeys=no',
    '-o','ProxyCommand=none','-o','ProxyJump=none',
    '-o','CanonicalizeHostname=no','-o','PermitLocalCommand=no',
    '-o','IdentitiesOnly=yes','-o','PreferredAuthentications=publickey',
    '-o','GSSAPIAuthentication=no','-o','ForwardAgent=no',
    '-o','ForwardX11=no',
    '-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no',
    '-o','ConnectTimeout=5','-o','ServerAliveInterval=5','-o','ServerAliveCountMax=1',
    '-p',String(config.sshPort),'-i',config.sshIdentityFile,'-l',config.sshUser,
    config.host,'/usr/bin/python3 -']
}
function childEnvironment(env=process.env) {
  const result={}
  for(const name of ['PATH','HOME','USER','LOGNAME','LANG','SSH_AUTH_SOCK','XDG_RUNTIME_DIR']) {
    if(typeof env[name]==='string')result[name]=env[name]
  }
  result.SSH_ASKPASS_REQUIRE='never'
  result.SSH_ASKPASS='/bin/false'
  return result
}

export async function runContentSsh(config,request,deps={}) {
  const payload=validateContentRequest(request)
  const source=await (deps.readWorker||(()=>readFile(
    new URL('../scripts/morkahja-content-ssh-worker.py',import.meta.url),'utf8')))()
  const encoded=Buffer.from(JSON.stringify(payload),'utf8').toString('base64')
  const code="REQUEST_BASE64 = '"+encoded+"'\n"+source
  return new Promise(resolve=>{
    const start=deps.spawn||spawn
    const child=start('ssh',buildContentSshArgs(config),{
      shell:false,stdio:['pipe','pipe','pipe'],env:childEnvironment(),
    })
    let stdout='',stderr='',overflow=false,timedOut=false,done=false
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},15000)
    const settle=result=>{
      if(done)return
      done=true
      clearTimeout(timer)
      resolve(result)
    }
    child.stdout?.on('data',chunk=>{
      if(overflow)return
      stdout+=String(chunk)
      if(Buffer.byteLength(stdout)>MAX_RESPONSE) {
        overflow=true
        child.kill('SIGKILL')
      }
    })
    child.stderr?.on('data',chunk=>{if(stderr.length<4096)
      stderr=(stderr+String(chunk)).slice(0,4096)})
    child.on('error',()=>settle({ok:false,code:'REMOTE_CONTENT_SSH_FAILED'}))
    child.on('close',(code,signal)=>{
      if(timedOut)return settle({ok:false,code:'REMOTE_CONTENT_TIMEOUT'})
      if(overflow)return settle({ok:false,code:'REMOTE_CONTENT_TOO_LARGE'})
      if(code!==0||signal)return settle({
        ok:false,code:classifySshExitDiagnostic(stderr)})
      let parsed
      try {parsed=JSON.parse(stdout)}catch{return settle({
        ok:false,code:'REMOTE_CONTENT_INVALID_RESPONSE'})}
      const safeCodes=['CONTENT_INVALID_REQUEST','CONTENT_INVALID_RECORD',
        'CONTENT_INVALID_SCHEMA','CONTENT_INVALID_JSON','CONTENT_NOT_FOUND',
        'CONTENT_CONFLICT','CONTENT_REVISION_REQUIRED','CONTENT_TOO_LARGE',
        'CONTENT_PERMISSION_DENIED','CONTENT_SOURCE_UNAVAILABLE',
        'CONTENT_ROOT_UNAVAILABLE','CONTENT_OPERATION_FAILED',
        'CONTENT_WRITE_VERIFY_FAILED','CONTENT_LOCK_UNSAFE']
      if(!parsed||typeof parsed!=='object'||typeof parsed.ok!=='boolean')
        return settle({ok:false,code:'REMOTE_CONTENT_INVALID_RESPONSE'})
      if(!parsed.ok)return settle({ok:false,code:safeCodes.includes(parsed.code)?
        parsed.code:'REMOTE_CONTENT_FAILED'})
      if(typeof parsed.revision!=='string' || !/^[a-f0-9]{64}$/.test(parsed.revision))
        return settle({ok:false,code:'REMOTE_CONTENT_INVALID_RESPONSE'})
      if(request.action==='read' && (!parsed.data ||
        typeof parsed.data!=='object'||Array.isArray(parsed.data)))
        return settle({ok:false,code:'REMOTE_CONTENT_INVALID_RESPONSE'})
      return settle({ok:true,data:parsed.data,revision:parsed.revision})
    })
    child.stdin?.on('error',()=>{})
    child.stdin?.end(code)
  })
}

export async function performMorkahjaContent(profile,request,deps={}) {
  if(active)return {ok:false,code:'REMOTE_CONTENT_BUSY'}
  try{validateContentRequest(request)}
  catch(error){return {ok:false,code:error.message}}
  active=true
  try {
    const approved=await (deps.readConfig||readMorkahjaContentConfig)(profile)
    if(!approved.ok)return {ok:false,code:approved.code}
    const result=await (deps.run||runContentSsh)(approved.config,request)
    return result.ok?{ok:true,data:result.data,revision:result.revision,
      checkedAt:new Date().toISOString()}:{ok:false,code:result.code}
  } catch{return {ok:false,code:'REMOTE_CONTENT_FAILED'}}
  finally{active=false}
}
