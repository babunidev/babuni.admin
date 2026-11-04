import { spawn } from 'node:child_process'
import { createServer, connect } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import { sshKnownHostsPath } from './sshHostPreflight.mjs'

// Every probe owns exactly one SSH child process and one ephemeral loopback forward.
// No background reconnect or session reuse is permitted.
const liveChildren=new Set()

function freeLoopbackPort() {
  return new Promise((resolve,reject)=>{
    const server=createServer()
    server.once('error',reject)
    server.listen(0,'127.0.0.1',()=>{
      const port=server.address().port
      server.close(error=>error?reject(error):resolve(port))
    })
  })
}
function isListening(port) {
  return new Promise(resolve=>{
    const socket=connect({host:'127.0.0.1',port})
    const done=value=>{socket.destroy();resolve(value)}
    socket.setTimeout(500,()=>done(false))
    socket.once('connect',()=>done(true))
    socket.once('error',()=>done(false))
  })
}
function stopChild(child) {
  if(child.exitCode!==null || child.signalCode!==null)return
  child.kill('SIGTERM')
  const timer=setTimeout(()=>{
    if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL')
  },500)
  timer.unref()
}
export function stopAllSshTunnels() {
  for(const child of liveChildren)stopChild(child)
}
export async function startSshTunnel(config) {
  const port=await freeLoopbackPort()
  const args=['-F','/dev/null','-N','-T',
    '-o','BatchMode=yes','-o','NumberOfPasswordPrompts=0',
    '-o','StrictHostKeyChecking=yes',
    '-o','UserKnownHostsFile='+sshKnownHostsPath(),
    '-o','GlobalKnownHostsFile=/dev/null','-o','UpdateHostKeys=no',
    '-o','ProxyCommand=none','-o','ProxyJump=none',
    '-o','CanonicalizeHostname=no','-o','PermitLocalCommand=no',
    '-o','IdentitiesOnly=yes','-o','PreferredAuthentications=publickey',
    '-o','GSSAPIAuthentication=no','-o','ForwardAgent=no',
    '-o','ForwardX11=no','-o','PermitTTY=no',
    '-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no',
    '-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=5',
    '-o','ServerAliveInterval=5','-o','ServerAliveCountMax=1',
    '-p',String(config.sshPort),'-i',config.sshIdentityFile,'-l',config.sshUser,
    '-L','127.0.0.1:'+port+':127.0.0.1:'+config.dbPort,config.host]
  // No remote shell command. ssh reads no terminal and never prompts for trust.
  // Do not leak the local service token, browser token or other app secrets to SSH.
  const childEnv={}
  for(const name of ['PATH','HOME','USER','LOGNAME','LANG','SSH_AUTH_SOCK','XDG_RUNTIME_DIR']) {
    if(typeof process.env[name]==='string')childEnv[name]=process.env[name]
  }
  childEnv.SSH_ASKPASS_REQUIRE='never'
  childEnv.SSH_ASKPASS='/bin/false'
  const child=spawn('ssh',args,{shell:false,stdio:['ignore','ignore','ignore'],env:childEnv})
  liveChildren.add(child)
  let exited=false
  child.on('exit',()=>{exited=true;liveChildren.delete(child)})
  child.on('error',()=>{exited=true;liveChildren.delete(child)})
  const stop=async()=>{
    if(child.exitCode===null && child.signalCode===null){
      const ended=new Promise(resolve=>child.once('exit',resolve))
      stopChild(child)
      await Promise.race([ended,sleep(1250)])
    }
    liveChildren.delete(child)
  }
  try {
    for(let n=0;n<35;n++){
      if(exited)throw new Error('SSH_SESSION_FAILED')
      if(await isListening(port))return {port,stop}
      await sleep(200)
    }
    throw new Error('SSH_FORWARD_TIMEOUT')
  }catch(error){await stop();throw error}
}
