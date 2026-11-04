import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readMorkahjaProbeConfig } from '../local-service/remoteProbeConfig.mjs'
import { probeMorkahjaPostgres, fetchMorkahjaReadOnly } from '../local-service/sshPostgresProbe.mjs'

const profile={projectId:'morkahja',kind:'postgres-ssh',
  target:'morkahja.example.invalid',id:'a72e405e-d30b-4328-a1aa-68b78540c0d4'}

test('remote config requires independent opt-in, exact host and fingerprint, and private files',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'babuni-remote-config-'))
  const identity=join(dir,'ssh-fixture')
  const knownHosts=join(dir,'known_hosts')
  const configPath=join(dir,'morkahja-probe.json')
  const original=process.env.BABUNI_SSH_KNOWN_HOSTS
  try {
    execFileSync('ssh-keygen',['-q','-t','ed25519','-N','','-f',identity],{stdio:'ignore'})
    const key=readFileSync(identity+'.pub','utf8').trim().split(/\s+/)
    writeFileSync(knownHosts,profile.target+' '+key[0]+' '+key[1]+'\n',{mode:0o600})
    process.env.BABUNI_SSH_KNOWN_HOSTS=knownHosts
    const fingerprint='SHA256:'+createHash('sha256').update(Buffer.from(key[1],'base64'))
      .digest('base64').replace(/=+$/,'')
    const config={enabled:true,host:profile.target,sshUser:'read_only',sshPort:22,
      sshIdentityFile:identity,dbUser:'babuni_reader',dbName:'babuni_fixture',
      dbPort:5432,approvedHostKeyFingerprint:fingerprint}
    const env={BABUNI_MORKAHJA_REMOTE_PROBE:'enabled',BABUNI_MORKAHJA_PROBE_CONFIG:configPath}
    const put=value=>writeFileSync(configPath,JSON.stringify(value)+'\n',{mode:0o600})
    put(config)
    assert.equal((await readMorkahjaProbeConfig(profile,{})).code,'REMOTE_PROBE_DISABLED')
    assert.equal((await readMorkahjaProbeConfig(profile,env)).ok,true)
    assert.equal((await readMorkahjaProbeConfig({...profile,projectId:'babuni-dev'},env)).code,'REMOTE_SCOPE_DENIED')
    put({...config,host:'unapproved.example.invalid'})
    assert.equal((await readMorkahjaProbeConfig(profile,env)).code,'REMOTE_CONFIG_INVALID')
    put({...config,approvedHostKeyFingerprint:'SHA256:'+('A'.repeat(43))})
    assert.equal((await readMorkahjaProbeConfig(profile,env)).code,'SSH_FINGERPRINT_MISMATCH')
    put(config)
    chmodSync(configPath,0o644)
    assert.equal((await readMorkahjaProbeConfig(profile,env)).code,'REMOTE_CONFIG_UNAVAILABLE')
    chmodSync(configPath,0o600)
    chmodSync(identity,0o644)
    assert.equal((await readMorkahjaProbeConfig(profile,env)).code,'SSH_IDENTITY_UNSAFE')
    chmodSync(identity,0o600)
    writeFileSync(knownHosts,profile.target+' '+key[0]+' '+key[1]+'\n'+
      profile.target+' '+key[0]+' '+key[1]+'\n')
    assert.equal((await readMorkahjaProbeConfig(profile,env)).code,'SSH_HOST_KEY_AMBIGUOUS')
  }finally {
    if(original===undefined) delete process.env.BABUNI_SSH_KNOWN_HOSTS
    else process.env.BABUNI_SSH_KNOWN_HOSTS=original
    rmSync(dir,{recursive:true,force:true})
  }
})

test('short-lived remote probe never connects when disabled and cleans up even on failure',async()=>{
  let opens=0
  let stops=0
  let credentials=0
  const config={dbUser:'babuni_reader',dbName:'babuni_fixture'}
  const deps={
    readConfig:async()=>({ok:false,code:'REMOTE_PROBE_DISABLED'}),
    getPassword:async()=>{credentials++;return 'fixture-only'},
    openTunnel:async()=>{opens++;return {socketDir:'/tmp/synthetic-private-socket',stop:async()=>{stops++}}},
    inspectDatabase:async()=>({ok:true}),
  }
  const disabled=await probeMorkahjaPostgres(profile,deps)
  assert.equal(disabled.code,'REMOTE_PROBE_DISABLED')
  assert.equal(opens,0)
  assert.equal(credentials,0)
  deps.readConfig=async()=>({ok:true,config})
  const success=await probeMorkahjaPostgres(profile,deps)
  assert.equal(success.code,'REMOTE_DB_HEALTHY_READ_ONLY')
  assert.equal(success.state,'disconnected')
  assert.ok(success.lastSuccessAt)
  assert.equal(opens,1)
  assert.equal(stops,1)
  deps.inspectDatabase=async()=>({ok:false,code:'DB_ROLE_NOT_READ_ONLY'})
  const unsafe=await probeMorkahjaPostgres(profile,deps)
  assert.equal(unsafe.code,'DB_ROLE_NOT_READ_ONLY')
  assert.equal(stops,2)
  deps.inspectDatabase=async()=>{throw new Error('sensitive error / do not leak')}
  const failure=await probeMorkahjaPostgres(profile,deps)
  assert.equal(failure.code,'REMOTE_PROBE_FAILED')
  assert.equal(JSON.stringify(failure).includes('sensitive error'),false)
  assert.equal(stops,3)
  let finish
  deps.inspectDatabase=()=>new Promise(resolve=>{finish=resolve})
  const pending=probeMorkahjaPostgres(profile,deps)
  const busy=await probeMorkahjaPostgres(profile,deps)
  assert.equal(busy.code,'REMOTE_PROBE_BUSY')
  // Allow the first async operation to reach the injected database callback.
  for(let i=0;i<30 && !finish;i++)await new Promise(r=>setTimeout(r,5))
  assert.ok(finish)
  finish({ok:true})
  assert.equal((await pending).code,'REMOTE_DB_HEALTHY_READ_ONLY')
  assert.equal(stops,4)
})


test('approved data read stays disabled by default, shares lock and closes tunnel',async()=>{
  let opens=0,stops=0,credentials=0,reads=0
  const config={readOnlyDataEnabled:false}
  const deps={
    readConfig:async()=>({ok:true,config}),
    getPassword:async()=>{credentials++;return 'synthetic'},
    openTunnel:async()=>{opens++;return {socketDir:'/tmp/disposable-socket',stop:async()=>{stops++}}},
    queryData:async()=>{reads++;return {ok:true,data:{players:2}}},
  }
  const denied=await fetchMorkahjaReadOnly(profile,'overview',1,deps)
  assert.equal(denied.code,'REMOTE_READ_DISABLED')
  assert.equal(opens,0)
  assert.equal(credentials,0)
  config.readOnlyDataEnabled=true
  config.readOnlyDataFields=['displayName','avatarCount']
  assert.equal((await fetchMorkahjaReadOnly(profile,'overview',1,deps)).code,'REMOTE_READ_DISABLED')
  config.readOnlyDataFields=['displayName','avatarCount','lastPlayedAt']
  const approved=await fetchMorkahjaReadOnly(profile,'overview',1,deps)
  assert.equal(approved.ok,true)
  assert.deepEqual(approved.data,{players:2})
  assert.equal(opens,1)
  assert.equal(reads,1)
  assert.equal(stops,1)
  deps.queryData=async()=>{throw new Error('private content must not leak')}
  const failed=await fetchMorkahjaReadOnly(profile,'players',1,deps)
  assert.deepEqual(failed,{ok:false,code:'REMOTE_READ_FAILED'})
  assert.equal(stops,2)
  let resume
  deps.queryData=()=>new Promise(resolve=>{resume=resolve})
  const held=fetchMorkahjaReadOnly(profile,'players',2,deps)
  assert.deepEqual(await fetchMorkahjaReadOnly(profile,'overview',1,deps),
    {ok:false,code:'REMOTE_PROBE_BUSY'})
  for(let n=0;n<40 && !resume;n++) await new Promise(r=>setTimeout(r,5))
  assert.ok(resume)
  resume({ok:true,data:{page:2,players:[]}})
  assert.equal((await held).ok,true)
  assert.equal(stops,3)
})
