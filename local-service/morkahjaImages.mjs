import {spawn} from 'node:child_process'
import {readMorkahjaContentConfig} from './morkahjaContentConfig.mjs'
import {buildContentSshArgs} from './morkahjaContentRunner.mjs'

const FOLDERS=Object.freeze({
  encounter:'game/encounterimages',
  solution:'game/solutionimages',
  expansion:'UI/03_DASHBOARD/expansions',
  frame:'UI/02_AvatarCreation/Frames',
  portrait:'UI/02_AvatarCreation/Avatare',
})
const MAX_IMAGE=2*1024*1024
const MAX_RESPONSE=3*1024*1024
const imageNamePattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}\.webp$/

export function imageRequest(value) {
  if(!value||typeof value!=='object'||Array.isArray(value) ||
    Object.keys(value).sort().join(',')!=='kind,name' ||
    !Object.hasOwn(FOLDERS,value.kind) || typeof value.name!=='string' ||
    !imageNamePattern.test(value.name))throw new Error('INVALID_IMAGE_REQUEST')
  return {kind:value.kind,name:value.name}
}

// The remote process accepts two individually checked tokens, never a path
// from HTTP. It rejects symlinks, oversized files, and anything outside the
// fixed public Morkahja asset folders.
const PYTHON=String.raw`
import base64,json,os,stat,sys
folders={
  "encounter":"game/encounterimages",
  "solution":"game/solutionimages",
  "expansion":"UI/03_DASHBOARD/expansions",
  "frame":"UI/02_AvatarCreation/Frames",
  "portrait":"UI/02_AvatarCreation/Avatare",
}
try:
  request=json.loads(REQUEST_JSON)
  kind=request["kind"]
  name=request["name"]
  if kind not in folders or not isinstance(name,str) or not name.endswith(".webp") or not name.replace("_","").replace("-","").replace(".","").isalnum() or len(name)>125:
    raise ValueError("INVALID_IMAGE_REQUEST")
  root="/var/www/morkahja"
  directory=os.path.join(root,folders[kind])
  dfd=os.open(directory,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
  try:
    fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=dfd)
    try:
      st=os.fstat(fd)
      if not stat.S_ISREG(st.st_mode) or st.st_size<=0 or st.st_size>2097152:
        raise ValueError("IMAGE_UNAVAILABLE")
      data=os.read(fd,2097153)
      if len(data)!=st.st_size:
        raise ValueError("IMAGE_UNAVAILABLE")
    finally:
      os.close(fd)
  finally:
    os.close(dfd)
  if not data.startswith(b"RIFF") or data[8:12]!=b"WEBP":
    raise ValueError("IMAGE_UNAVAILABLE")
  print(json.dumps({"ok":True,"base64":base64.b64encode(data).decode("ascii")}))
except Exception:
  print(json.dumps({"ok":False,"code":"IMAGE_UNAVAILABLE"}))
`

export function runImageSsh(config,request,{start=spawn}={}) {
  const valid=imageRequest(request)
  return new Promise(resolve=>{
    const child=start('ssh',buildContentSshArgs(config),{
      shell:false,stdio:['pipe','pipe','pipe'],
      env:Object.fromEntries(
        ['PATH','HOME','USER','LOGNAME','LANG','SSH_AUTH_SOCK','XDG_RUNTIME_DIR']
          .filter(k=>typeof process.env[k]==='string')
          .map(k=>[k,process.env[k]])),
    })
    let output='',received=0,finished=false,timedOut=false
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},12000)
    const done=result=>{
      if(finished)return
      finished=true
      clearTimeout(timer)
      resolve(result)
    }
    child.on('error',()=>done({ok:false,code:'IMAGE_SSH_FAILED'}))
    child.stdout?.on('data',chunk=>{
      received+=chunk.length
      if(received>MAX_RESPONSE){child.kill('SIGKILL');return}
      output+=chunk.toString('utf8')
    })
    child.on('close',(code,signal)=>{
      if(timedOut)return done({ok:false,code:'IMAGE_TIMEOUT'})
      if(received>MAX_RESPONSE)return done({ok:false,code:'IMAGE_TOO_LARGE'})
      if(code!==0||signal)return done({ok:false,code:'IMAGE_SSH_FAILED'})
      let data
      try{data=JSON.parse(output)}catch{return done({ok:false,code:'IMAGE_INVALID_RESPONSE'})}
      if(!data?.ok)return done({ok:false,code:'IMAGE_UNAVAILABLE'})
      if(typeof data.base64!=='string'||data.base64.length>MAX_RESPONSE ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))
        return done({ok:false,code:'IMAGE_INVALID_RESPONSE'})
      const bytes=Buffer.from(data.base64,'base64')
      if(bytes.length<12||bytes.length>MAX_IMAGE||bytes.toString('ascii',0,4)!=='RIFF'||
        bytes.toString('ascii',8,12)!=='WEBP')
        return done({ok:false,code:'IMAGE_INVALID_RESPONSE'})
      done({ok:true,base64:data.base64,contentType:'image/webp'})
    })
    child.stdin?.on('error',()=>{})
    try{child.stdin?.end(
      'REQUEST_JSON='+JSON.stringify(JSON.stringify(valid))+'\n'+PYTHON+'\n'
    )}catch{child.kill('SIGKILL');done({ok:false,code:'IMAGE_SSH_FAILED'})}
  })
}

export async function fetchMorkahjaImage(profile,request,deps={}) {
  let valid
  try{valid=imageRequest(request)}catch{return {ok:false,code:'INVALID_IMAGE_REQUEST'}}
  const approved=await (deps.readConfig||readMorkahjaContentConfig)(profile)
  if(!approved.ok)return {ok:false,code:approved.code}
  return (deps.run||runImageSsh)(approved.config,valid)
}
