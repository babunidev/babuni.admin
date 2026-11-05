import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { sshKnownHostsPath } from './sshHostPreflight.mjs'

// Every probe owns a user-private, randomized Unix socket and exactly one SSH child.
// No TCP listener, background reconnect, or persistent session is exposed locally.
const liveSessions=new Set()
const localSocketName='.s.PGSQL.5432'

function isListening(path) {
  return new Promise(resolve=>{
    const socket=connect({path})
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
export async function stopAllSshTunnels() {
  await Promise.all([...liveSessions].map(session=>session.stop()))
}
export function buildSshTunnelArgs(config, socketPath) {
  return ['-F','/dev/null','-N','-T',
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
    '-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=5',
    '-o','ServerAliveInterval=5','-o','ServerAliveCountMax=1',
    '-p',String(config.sshPort),'-i',config.sshIdentityFile,'-l',config.sshUser,
    '-L',socketPath+':127.0.0.1:'+config.dbPort,config.host]
}

// Raw SSH diagnostics can include private key paths and usernames. Inspect them
// inside the local service only; return one fixed category to the UI.
export function classifySshExitDiagnostic(message) {
  const value=typeof message==='string'?message.slice(0,4096):''
  if(/host key verification failed|remote host identification has changed|no .* host key is known|offending .* key/i.test(value)) {
    return 'SSH_HOST_KEY_REJECTED'
  }
  if(/identity file .* not accessible|load key .* (?:error|invalid|refused|permission denied)|sign_and_send_pubkey: signing failed/i.test(value)) {
    return 'SSH_IDENTITY_UNAVAILABLE'
  }
  if(/permission denied \(publickey|too many authentication failures|authentication failed/i.test(value)) {
    return 'SSH_AUTH_REJECTED'
  }
  if(/administratively prohibited|port forwarding (?:is )?disabled|forwarding request failed|cannot listen to port|bind .* address already in use/i.test(value)) {
    return 'SSH_FORWARD_DENIED'
  }
  if(/bad configuration option|unsupported option|unknown configuration option|unknown cipher type/i.test(value)) {
    return 'SSH_CLIENT_CONFIG_INVALID'
  }
  if(/could not resolve hostname|name or service not known|connection refused|connection timed out|network is unreachable|no route to host|connection reset by|connection closed by|operation timed out/i.test(value)) {
    return 'SSH_HOST_UNREACHABLE'
  }
  return 'SSH_SESSION_FAILED'
}

export async function startSshTunnel(config) {
  const socketDir=await mkdtemp(join(tmpdir(),'babuni-ssh-pg-'))
  const socketPath=join(socketDir,localSocketName)
  const args=buildSshTunnelArgs(config,socketPath)
  // The SSH process cannot inherit application tokens or any arbitrary environment.
  const childEnv={}
  for(const name of ['PATH','HOME','USER','LOGNAME','LANG','SSH_AUTH_SOCK','XDG_RUNTIME_DIR']) {
    if(typeof process.env[name]==='string')childEnv[name]=process.env[name]
  }
  childEnv.SSH_ASKPASS_REQUIRE='never'
  childEnv.SSH_ASKPASS='/bin/false'
  let child
  try {
    child=spawn('ssh',args,{shell:false,stdio:['ignore','ignore','pipe'],env:childEnv})
  }catch(error){
    await rm(socketDir,{recursive:true,force:true})
    throw error
  }
  // Keep a small in-memory diagnostic solely for categorization. Never log,
  // persist, or return stderr, argv, environment or SSH identity details.
  let sshDiagnostic=''
  child.stderr?.on('data',chunk=>{
    if(sshDiagnostic.length<4096) {
      sshDiagnostic=(sshDiagnostic+String(chunk)).slice(0,4096)
    }
  })
    const session={child,socketDir}
  liveSessions.add(session)
  let exited=false
  child.on('exit',()=>{
    exited=true
    liveSessions.delete(session)
    void rm(socketDir,{recursive:true,force:true}).catch(()=>{})
  })
  child.on('error',()=>{exited=true;liveSessions.delete(session)})
  const stop=async()=>{
    if(child.exitCode===null && child.signalCode===null){
      const ended=new Promise(resolve=>child.once('exit',resolve))
      stopChild(child)
      await Promise.race([ended,sleep(1250)])
    }
    liveSessions.delete(session)
    await rm(socketDir,{recursive:true,force:true})
  }
  session.stop=stop
  try {
    for(let n=0;n<35;n++){
      if(exited)throw new Error(classifySshExitDiagnostic(sshDiagnostic))
      if(await isListening(socketPath))return {socketDir,stop}
      await sleep(200)
    }
    throw new Error('SSH_FORWARD_TIMEOUT')
  }catch(error){await stop();throw error}
}
