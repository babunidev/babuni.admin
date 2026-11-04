import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, lstatSync, readFileSync, symlinkSync, unlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MorkahjaTunnelManager, buildSshArgs } from '../local-service/morkahjaTunnel.mjs'
import { readMorkahjaConfig, saveMorkahjaConfig } from '../local-service/morkahjaConfig.mjs'
import { verifyReadonlyRole, readPlayerPreview, readDatabaseHealth } from '../local-service/morkahjaReadonly.mjs'

const profile={id:'f65cb824-44e9-4a56-bf19-9155b38cd987',
  projectId:'morkahja',kind:'postgres-ssh',target:'morkahja.example.test'}
const config={sshUser:'deploy',databaseUser:'morkahja_reader',databaseName:'morkahja'}
function fakeChild() {
  const child=new EventEmitter()
  child.exitCode=null;child.signalCode=null;child.killed=false
  child.kill=()=>{
    child.killed=true;child.exitCode=0;child.emit('exit',0)
  }
  return child
}
function fixture(overrides={}) {
  const calls=[],children=[],clients=[]
  const scenario={role:{database_name:'morkahja',role_name:'morkahja_reader',
    elevated:false,can_read:true,can_write:false},
    connectFailure:false,broken:false,...overrides}
  class Client {
    constructor(options){this.options=options;this.closed=false;clients.push(this)}
    on(){}
    async connect(){if(scenario.connectFailure)throw Error('connection refused')}
    async query(sql) {
      calls.push(sql.trim())
      if(scenario.broken)throw Error('database connection lost')
      if(sql.includes('FROM pg_roles'))return {rows:[scenario.role]}
      if(sql.includes("transaction_read_only"))return {rows:[{
        database_name:'morkahja',read_only:'on',server_time:new Date(),
      }]}
      if(sql.includes('FROM public.players'))return {rows:[{id:'fixture-001',name:'Fixture Player'}]}
      return {rows:[]}
    }
    async end(){this.closed=true}
  }
  const manager=new MorkahjaTunnelManager({
    loadConfig:()=>config,credential:async()=> 'fixture-only-secret',
    isKnownHost:async()=>scenario.trusted!==false,
    reservePort:async()=>54123,
    startTunnel:()=>{const child=fakeChild();children.push(child);return child},
    makeClient:opts=>new Client(opts),maxConnectAttempts:2,retryDelayMs:0,
  })
  return {manager,calls,children,clients,scenario}
}
test('private Morkahja DB config validates identity and stores no password',()=>{
  const directory=mkdtempSync(join(tmpdir(),'babuni-morkahja-settings-'))
  const original=process.env.BABUNI_TEST_MORKAHJA_CONFIG_DIR
  process.env.BABUNI_TEST_MORKAHJA_CONFIG_DIR=directory
  try {
    const saved=saveMorkahjaConfig(profile,config)
    assert.deepEqual(saved,config)
    assert.deepEqual(readMorkahjaConfig(profile),config)
    const file=join(directory,profile.id+'.json')
    assert.equal(lstatSync(file).mode&0o077,0)
    assert.equal(readFileSync(file,'utf8').includes('password'),false)
    assert.throws(()=>saveMorkahjaConfig(profile,{...config,databaseUser:'root;DROP TABLE'}),
      /INVALID_DB_CONFIG/)
    assert.throws(()=>saveMorkahjaConfig(profile,{...config,password:'fixture'}),
      /INVALID_DB_CONFIG/)
    const link=join(directory,'fake')
    symlinkSync(file,link)
    assert.equal(lstatSync(link).isSymbolicLink(),true)
    unlinkSync(link)
  }finally{
    if(original===undefined)delete process.env.BABUNI_TEST_MORKAHJA_CONFIG_DIR
    else process.env.BABUNI_TEST_MORKAHJA_CONFIG_DIR=original
    rmSync(directory,{recursive:true,force:true})
  }
})
test('read-only SQL never invokes the legacy session-cleanup/write adapter',async()=>{
  const {calls,clients,manager}=fixture()
  const result=await manager.connect(profile)
  assert.equal(result.ok,true)
  assert.equal(result.status.code,'DATABASE_READ_ONLY_CONNECTED')
  assert.equal((await manager.health(profile)).health.readOnly,true)
  const players=await manager.players(profile)
  assert.equal(players.readOnly,true)
  assert.deepEqual(players.players,[{id:'fixture-001',name:'Fixture Player'}])
  assert.equal(clients[0].options.host,'127.0.0.1')
  assert.equal(clients[0].options.ssl,false)
  assert.equal(clients[0].options.password,'fixture-only-secret')
  assert.ok(calls.some(sql=>sql.startsWith('BEGIN READ ONLY')))
  assert.ok(calls.every(sql=>!/^(UPDATE|DELETE|INSERT|TRUNCATE|ALTER|DROP|CREATE)/i.test(sql)))
  await manager.disconnect(profile.id)
  assert.equal(clients[0].closed,true)
  assert.equal(manager.isConnected(profile.id),false)
})
test('unknown SSH host and privileged database role fail closed',async()=>{
  const untrusted=fixture({trusted:false})
  assert.deepEqual(await untrusted.manager.connect(profile),{ok:false,error:'SSH_HOST_NOT_TRUSTED'})
  assert.equal(untrusted.children.length,0)
  const privileged=fixture({role:{database_name:'morkahja',elevated:true,
    can_read:true,can_write:true}})
  assert.equal((await privileged.manager.connect(profile)).error,'DB_ROLE_NOT_READ_ONLY')
  assert.equal(privileged.clients[0].closed,true)
  assert.equal(privileged.children[0].killed,true)
  assert.equal(privileged.manager.isConnected(profile.id),false)
})
test('database failure and changed target cannot leave a usable stale session',async()=>{
  const f=fixture()
  assert.equal((await f.manager.connect(profile)).ok,true)
  assert.equal((await f.manager.players({...profile,target:'another.example.test'})).error,'PROFILE_CHANGED')
  f.scenario.broken=true
  assert.equal((await f.manager.health(profile)).error,'DATABASE_UNAVAILABLE')
  assert.equal(f.manager.isConnected(profile.id),false)
  assert.equal(f.children[0].killed,true)
})
test('readonly queries reject privileged roles and enforce transaction boundaries',async()=>{
  const client={
    query:async(sql)=>({rows:sql.includes('FROM pg_roles')
      ? [{elevated:false,can_read:true,can_write:true}] : []}),
  }
  await assert.rejects(()=>verifyReadonlyRole(client),/DB_ROLE_NOT_READ_ONLY/)
  const f=fixture()
  const c=f.manager.deps.makeClient({host:'127.0.0.1'})
  assert.equal((await readDatabaseHealth(c)).readOnly,true)
  assert.equal((await readPlayerPreview(c))[0].id,'fixture-001')
})

test('SSH argv enforces pinned host, localhost forwarding and noninteractive authentication',()=>{
  const args=buildSshArgs(profile,config,51432)
  assert.ok(args.includes('StrictHostKeyChecking=yes'))
  assert.ok(args.includes('BatchMode=yes'))
  assert.ok(args.includes('ForwardAgent=no'))
  assert.ok(args.includes('ExitOnForwardFailure=yes'))
  assert.ok(args.includes('PasswordAuthentication=no'))
  assert.ok(args.includes('127.0.0.1:51432:127.0.0.1:5432'))
  assert.ok(args.includes('-F'))
  assert.ok(args.includes('/dev/null'))
  assert.equal(args.at(-1),config.sshUser+'@'+profile.target)
  assert.equal(args.includes('StrictHostKeyChecking=accept-new'),false)
})
