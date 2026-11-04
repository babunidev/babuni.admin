import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'

function requestWithHost(url, headers) {
  return new Promise((resolve,reject)=>{
    const req=httpRequest(url,{headers:{...headers,Host:'attacker.invalid'}},res=>{
      res.resume()
      res.on('end',()=>resolve(res.statusCode))
    })
    req.on('error',reject)
    req.end()
  })
}
async function freePort(){
  const srv=createServer()
  await new Promise(r=>srv.listen(0,'127.0.0.1',r))
  const port=srv.address().port
  await new Promise(r=>srv.close(r))
  return port
}
test('independent local service requires session key and tests local folder without writes',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'babuni-local-service-'))
  const port=await freePort()
  const key=randomBytes(32).toString('hex')
  const sshTrust=join(dir,'ssh_known_hosts')
  const child=spawn(process.execPath,['--experimental-strip-types','local-service/server.mjs'],{
    env:{...process.env,BABUNI_LOCAL_SERVICE_PORT:String(port),BABUNI_LOCAL_SERVICE_TOKEN:key,
      BABUNI_TEST_PROFILE_FILE:join(dir,'profiles.json'),BABUNI_UI_PORT:'5180',
      BABUNI_SSH_KNOWN_HOSTS:sshTrust},stdio:['ignore','pipe','pipe']
  })
  const url='http://127.0.0.1:'+port+'/local-connections-api/'
  const headers={'X-Babuni-Local':'1','X-Babuni-Service-Key':key,'Content-Type':'application/json',Origin:'http://127.0.0.1:5180'}
  async function request(path='',init={}) { return fetch(url+path,{...init,headers:{...headers,...init.headers}}) }
  try {
    let up=false
    for(let n=0;n<40;n++){
      if(child.exitCode!==null) break
      try{const response=await request();if(response.ok){up=true;break}}catch{}
      await new Promise(r=>setTimeout(r,100))
    }
    assert.ok(up,'service failed to bind')
    assert.equal((await fetch(url)).status,403)
    assert.equal((await fetch(url+'health')).status,403)
    assert.equal(await requestWithHost(url,headers),403)
    assert.equal((await request('',{method:'POST',headers:{Origin:''}})).status,403)
    const health=await (await request('health')).json()
    assert.equal(health.ok,true)
    assert.equal(health.mode,'local-only')
    assert.ok(['available','unavailable','locked'].includes(health.keyring))
    assert.equal((await fetch(url,{headers:{...headers,'X-Babuni-Service-Key':'incorrect'}})).status,403)
    assert.equal((await request('',{headers:{Origin:'https://bad.example'}})).status,403)
    assert.equal((await request('',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403)
    mkdirSync(join(dir,'game'))
    writeFileSync(join(dir,'game','encountersdata.json'), JSON.stringify({'001':{name:'fixture'},_meta:{version:1}}))
    symlinkSync(join(dir,'game','encountersdata.json'), join(dir,'game','solutiondata.json'))
    writeFileSync(join(dir,'game','portraits.json'), JSON.stringify({Avatar:[null,{avatarID:1}]}))
    writeFileSync(join(dir,'game','frames.json'), JSON.stringify({Frames:[null,{frameID:1}]}))
    writeFileSync(join(dir,'game','expansiondata.json'), JSON.stringify({expansions:{one:{}}}))
    const added=await request('',{method:'POST',body:JSON.stringify({
      projectId:'morkahja',kind:'local-files',displayName:'Fixture',target:dir,
    })})
    assert.equal(added.status,201)
    const p=(await added.json()).profile
    assert.equal(p.state,'not-configured')
    const inspected=await request(p.id+'/inspect')
    assert.equal(inspected.status,200)
    const report=await inspected.json()
    assert.equal(report.readOnly,true)
    assert.equal(report.files[0].entries,1)
    assert.equal(report.files[1].status,'unavailable')
    assert.equal(report.files[1].reason,'UNSAFE_PATH')
    assert.equal(report.files[2].status,'available')
    assert.equal(report.files[4].status,'available')
    assert.equal(report.files[4].entries,2)
    const afterInspection=(await (await request()).json()).profiles[0]
    assert.equal(afterInspection.state,'degraded')
    assert.equal(afterInspection.code,'CONTENT_PARTIAL')
    assert.ok(afterInspection.checkedAt)
    const checked=await request(p.id+'/test',{method:'POST'})
    assert.equal(checked.status,200)
    const status=(await checked.json()).status
    assert.equal(status.state,'available')
    assert.equal(status.code,'DIRECTORY_AVAILABLE')
    assert.ok(status.lastSuccessAt)
    const rows=(await (await request()).json()).profiles
    assert.equal(rows.length,1)
    assert.equal(rows[0].state,'available')
    const connected=await request(p.id+'/connect',{method:'POST'})
    assert.equal(connected.status,200)
    assert.equal((await connected.json()).status.state,'connected')
    assert.equal((await (await request()).json()).profiles[0].state,'connected')
    const disconnected=await request(p.id+'/disconnect',{method:'POST'})
    assert.equal(disconnected.status,200)
    assert.equal((await disconnected.json()).status.state,'disconnected')
    assert.equal((await (await request()).json()).profiles[0].state,'disconnected')
    const reconnected=await request(p.id+'/reconnect',{method:'POST'})
    assert.equal(reconnected.status,200)
    assert.equal((await reconnected.json()).status.state,'connected')
    const renamed=await request(p.id,{method:'PUT',body:JSON.stringify({
      displayName:'Renamed Fixture',target:dir,
    })})
    assert.equal(renamed.status,200)
    assert.equal((await renamed.json()).profile.displayName,'Renamed Fixture')
    assert.equal((await (await request()).json()).profiles[0].state,'connected')
    const rejectedEdit=await request(p.id,{method:'PUT',body:JSON.stringify({
      displayName:'Bad',target:dir,projectId:'babuni-dev',
    })})
    assert.equal(rejectedEdit.status,400)
    const moved=await request(p.id,{method:'PUT',body:JSON.stringify({
      displayName:'Renamed Fixture',target:dir+'/unavailable',
    })})
    assert.equal(moved.status,200)
    assert.equal((await (await request()).json()).profiles[0].state,'not-configured')
    const cantConnect=await request(p.id+'/connect',{method:'POST'})
    assert.equal(cantConnect.status,422)
    assert.equal((await cantConnect.json()).status.code,'DIRECTORY_MISSING')
    const missing=await request('',{method:'POST',body:JSON.stringify({
      projectId:'morkahja',kind:'local-files',displayName:'Missing',target:dir+'/not-found',
    })})
    const missingId=(await missing.json()).profile.id
    const miss=(await (await request(missingId+'/test',{method:'POST'})).json()).status
    assert.equal(miss.state,'error')
    assert.equal(miss.code,'DIRECTORY_MISSING')
    const remote=await request('',{method:'POST',body:JSON.stringify({
      projectId:'babuni-dev',kind:'github',displayName:'GitHub',target:'babunidev/test',
    })})
    const remoteId=(await remote.json()).profile.id
    const checkRemote=(await (await request(remoteId+'/test',{method:'POST'})).json()).status
    assert.equal(checkRemote.state,'not-configured')
    assert.equal(checkRemote.code,'ADAPTER_NOT_IMPLEMENTED')
    assert.equal((await request(remoteId+'/connect',{method:'POST'})).status,409)
    assert.equal((await request(remoteId+'/inspect')).status,403)
    assert.ok(['missing','unavailable'].includes(checkRemote.credential))
    const sshResponse=await request('',{method:'POST',body:JSON.stringify({
      projectId:'morkahja',kind:'postgres-ssh',displayName:'Offline SSH',
      target:'morkahja.example.invalid',
    })})
    assert.equal(sshResponse.status,201)
    const sshProfile=(await sshResponse.json()).profile
    const unpinned=await (await request(sshProfile.id+'/test',{method:'POST'})).json()
    assert.equal(unpinned.status.code,'SSH_TRUST_STORE_MISSING')
    const sshKey=join(dir,'ssh-fixture')
    execFileSync('ssh-keygen',['-q','-t','ed25519','-N','','-f',sshKey],{stdio:'ignore'})
    const pub=readFileSync(sshKey+'.pub','utf8').trim().split(/\s+/)
    writeFileSync(sshTrust,'morkahja.example.invalid '+pub[0]+' '+pub[1]+'\n',{mode:0o600})
    const pinned=await (await request(sshProfile.id+'/test',{method:'POST'})).json()
    assert.equal(pinned.status.code,'SSH_HOST_KEY_PINNED_OFFLINE')
    assert.equal(pinned.status.state,'not-configured')
    assert.equal((await request(sshProfile.id+'/connect',{method:'POST'})).status,409)
    assert.equal((await request(sshProfile.id+'/inspect')).status,403)
    const listedSsh=(await (await request()).json()).profiles.find(row=>row.id===sshProfile.id)
    assert.deepEqual(listedSsh.capabilities,['ssh:preflight','ssh:probe','ssh:read'])
    const liveDisabled=await (await request(sshProfile.id+'/probe',{method:'POST'})).json()
    assert.equal(liveDisabled.status.code,'REMOTE_PROBE_DISABLED')
    assert.equal(liveDisabled.status.state,'not-configured')
    assert.equal((await request(remoteId+'/probe',{method:'POST'})).status,403)
    assert.equal((await request(p.id+'/probe',{method:'POST'})).status,403)
    assert.equal((await request(sshProfile.id+'/read-players',{
      method:'POST',body:JSON.stringify({page:0}),
    })).status,400)
    assert.equal((await request(sshProfile.id+'/read-players',{
      method:'POST',body:JSON.stringify({page:1,extra:'secret'}),
    })).status,400)
    const readDisabled=await request(sshProfile.id+'/read-overview',{method:'POST'})
    assert.equal(readDisabled.status,403)
    assert.equal((await readDisabled.json()).error,'REMOTE_PROBE_DISABLED')
    assert.equal((await request(sshProfile.id+'/read-players',{
      method:'POST',body:JSON.stringify({page:1}),
    })).status,403)
    assert.equal((await request(remoteId+'/read-overview',{method:'POST'})).status,403)
    assert.equal((await request(p.id+'/read-players',{
      method:'POST',body:JSON.stringify({page:1}),
    })).status,403)
    assert.equal((await request(sshProfile.id+'/read-overview',{
      method:'POST',headers:{Origin:'https://attacker.invalid'},
    })).status,403)
    assert.equal(listedSsh.state,'not-configured')
    // The disposable CI service may have no Secret Service keyring.
    // Remote profile deletion fails closed in that situation; leave its
    // fixture metadata for temporary-directory teardown instead.
    assert.equal((await request(p.id,{method:'DELETE'})).status,200)
    assert.equal((await (await request()).json()).profiles.length,3)
  } finally{
    child.kill('SIGTERM')
    await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r)})
    rmSync(dir,{recursive:true,force:true})
  }
})
