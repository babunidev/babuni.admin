import { spawn, execFile } from 'node:child_process'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { readMorkahjaConfig } from './morkahjaConfig.mjs'
import { readCredential } from './keyring.mjs'
import { verifyReadonlyRole, readDatabaseHealth, readPlayerPreview } from './morkahjaReadonly.mjs'
import { hasCapability } from '../vite/connectionAdapters.ts'

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function locatePort(){
  return new Promise((resolve,reject)=>{
    const server=createServer()
    server.once('error',reject)
    server.listen(0,'127.0.0.1',()=>{
      const port=server.address().port
      server.close(error=>error?reject(error):resolve(port))
    })
  })
}
function knownHost(host) {
  return new Promise(resolve=>{
    const knownHosts=join(homedir(),'.ssh','known_hosts')
    const child=execFile('ssh-keygen',['-F',host,'-f',knownHosts],
      {timeout:3000,maxBuffer:8192},(error,stdout)=>resolve(!error && stdout.trim().length>0))
    child.stdin?.end()
  })
}
export function buildSshArgs(profile,config,port) {
  const args=[
    '-F','/dev/null','-N','-T','-p','22',
    '-o','BatchMode=yes','-o','PasswordAuthentication=no',
    '-o','KbdInteractiveAuthentication=no','-o','StrictHostKeyChecking=yes',
    '-o','UserKnownHostsFile='+join(homedir(),'.ssh','known_hosts'),
    '-o','ExitOnForwardFailure=yes','-o','ClearAllForwardings=yes',
    '-o','ForwardAgent=no','-o','ConnectTimeout=8',
    '-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2',
    '-L',`127.0.0.1:${port}:127.0.0.1:5432`,
  ]
  if(config.identityFile)args.push('-i',config.identityFile,'-o','IdentitiesOnly=yes')
  args.push('--',config.sshUser+'@'+profile.target)
  return args
}
function startTunnel(profile,config,port) {
  // Never invoke a shell or print stderr; SSH agent/private key stays with OpenSSH.
  return spawn('ssh',buildSshArgs(profile,config,port),
    {stdio:['ignore','ignore','ignore'],shell:false})
}

export class MorkahjaTunnelManager {
  constructor(deps={}) {
    this.deps={
      loadConfig:readMorkahjaConfig,
      credential:readCredential,
      isKnownHost:knownHost,
      reservePort:locatePort,
      startTunnel,
      makeClient:opts=>new pg.Client(opts),
      maxConnectAttempts:35,
      retryDelayMs:200,
      ...deps,
    }
    this.sessions=new Map()
    this.busy=new Set()
    this.cancelled=new Set()
    this.inflightChildren=new Map()
  }
  isConnected(id) {
    const session=this.sessions.get(id)
    return Boolean(session && !session.dead && session.child.exitCode===null)
  }
  async connect(profile) {
    if(!hasCapability(profile,'db:connect'))return {ok:false,error:'CAPABILITY_DENIED'}
    if(this.busy.has(profile.id))return {ok:false,error:'CONNECTION_BUSY'}
    this.busy.add(profile.id)
    this.cancelled.delete(profile.id)
    let child
    let client
    try {
      await this.disconnect(profile.id,false)
      const config=this.deps.loadConfig(profile)
      if(!await this.deps.isKnownHost(profile.target))return {ok:false,error:'SSH_HOST_NOT_TRUSTED'}
      const password=await this.deps.credential(profile)
      const port=await this.deps.reservePort()
      child=this.deps.startTunnel(profile,config,port)
      this.inflightChildren.set(profile.id,child)
      child.on('error',()=>{})
      const credentials={
        host:'127.0.0.1',port,user:config.databaseUser,database:config.databaseName,
        password,ssl:false,connectionTimeoutMillis:1200,query_timeout:3500,
        statement_timeout:3000,application_name:'babuni-admin-read-only',
      }
      let connected=false
      for(let retry=0;retry<this.deps.maxConnectAttempts;retry++){
        if(child.exitCode!==null || child.signalCode!==null)break
        client=this.deps.makeClient(credentials)
        client.on?.('error',()=>{})
        try {await client.connect();connected=true;break}
        catch {try {await client.end()}catch{};client=undefined;await pause(this.deps.retryDelayMs)}
      }
      if(!connected)return {ok:false,error:'SSH_OR_DATABASE_UNAVAILABLE'}
      const role=await verifyReadonlyRole(client)
      if(role.database!==config.databaseName)return {ok:false,error:'DATABASE_IDENTITY_MISMATCH'}
      const health=await readDatabaseHealth(client)
      if(this.cancelled.has(profile.id))return {ok:false,error:'CONNECTION_CANCELLED'}
      const session={child,client,profileHost:profile.target,dead:false}
      this.sessions.set(profile.id,session)
      client.on?.('error',()=>{if(this.sessions.get(profile.id)===session)void this.disconnect(profile.id)})
      child.on('exit',()=>{
        if(this.sessions.get(profile.id)===session){
          session.dead=true
          this.sessions.delete(profile.id)
          void client.end().catch(()=>{})
        }
      })
      // Ownership of handles passes to this.sessions.
      child=undefined;client=undefined
      return {ok:true,status:{
        state:'connected',code:'DATABASE_READ_ONLY_CONNECTED',
        detail:'Verified SSH host and read-only database role. No write operations enabled.',
        checkedAt:health.checkedAt,lastSuccessAt:health.checkedAt,
      }}
    }catch(error) {
      const code=[
        'DB_CONFIG_MISSING','INSECURE_DB_CONFIG','INVALID_DB_CONFIG',
        'DB_CREDENTIAL_MISSING','KEYRING_UNAVAILABLE',
        'DB_ROLE_NOT_READ_ONLY','DATABASE_IDENTITY_MISMATCH',
      ].includes(error?.message)?error.message:'SSH_OR_DATABASE_UNAVAILABLE'
      return {ok:false,error:code}
    }finally{
      if(client)try{await client.end()}catch{}
      if(child)child.kill('SIGTERM')
      this.busy.delete(profile.id)
      this.cancelled.delete(profile.id)
      this.inflightChildren.delete(profile.id)
    }
  }
  async health(profile) {
    if(!hasCapability(profile,'db:health'))return {ok:false,error:'CAPABILITY_DENIED'}
    const session=this.sessions.get(profile.id)
    if(!session||!this.isConnected(profile.id))return {ok:false,error:'DATABASE_NOT_CONNECTED'}
    if(session.profileHost!==profile.target)return {ok:false,error:'PROFILE_CHANGED'}
    try{return {ok:true,health:await readDatabaseHealth(session.client)}}
    catch {
      await this.disconnect(profile.id)
      return {ok:false,error:'DATABASE_UNAVAILABLE'}
    }
  }
  async players(profile) {
    if(!hasCapability(profile,'db:players'))return {ok:false,error:'CAPABILITY_DENIED'}
    const session=this.sessions.get(profile.id)
    if(!session||!this.isConnected(profile.id))return {ok:false,error:'DATABASE_NOT_CONNECTED'}
    if(session.profileHost!==profile.target)return {ok:false,error:'PROFILE_CHANGED'}
    try{return {ok:true,readOnly:true,source:'morkahja-postgres-ssh',
      players:await readPlayerPreview(session.client)}}
    catch {
      await this.disconnect(profile.id)
      return {ok:false,error:'DATABASE_UNAVAILABLE'}
    }
  }
  async disconnect(id,cancelPending=true) {
    if(cancelPending&&this.busy.has(id))this.cancelled.add(id)
    const pendingChild=this.inflightChildren.get(id)
    if(cancelPending && pendingChild && pendingChild.exitCode===null)pendingChild.kill('SIGTERM')
    const session=this.sessions.get(id)
    if(!session)return
    this.sessions.delete(id)
    session.dead=true
    try {await session.client.end()}catch{}
    if(session.child.exitCode===null)session.child.kill('SIGTERM')
  }
  async closeAll(){
    const ids=new Set([...this.sessions.keys(),...this.busy.keys()])
    await Promise.all([...ids].map(id=>this.disconnect(id)))
  }
}
