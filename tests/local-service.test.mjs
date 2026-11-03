import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'

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
  const child=spawn(process.execPath,['--experimental-strip-types','local-service/server.mjs'],{
    env:{...process.env,BABUNI_LOCAL_SERVICE_PORT:String(port),BABUNI_LOCAL_SERVICE_TOKEN:key,
      BABUNI_TEST_PROFILE_FILE:join(dir,'profiles.json'),BABUNI_UI_PORT:'5180'},stdio:['ignore','pipe','pipe']
  })
  const url='http://127.0.0.1:'+port+'/local-connections-api/'
  const headers={'X-Babuni-Local':'1','X-Babuni-Service-Key':key,'Content-Type':'application/json'}
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
    assert.equal((await fetch(url,{headers:{...headers,'X-Babuni-Service-Key':'incorrect'}})).status,403)
    assert.equal((await request('',{headers:{Origin:'https://bad.example'}})).status,403)
    assert.equal((await request('',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403)
    const added=await request('',{method:'POST',body:JSON.stringify({
      projectId:'morkahja',kind:'local-files',displayName:'Fixture',target:dir,
    })})
    assert.equal(added.status,201)
    const p=(await added.json()).profile
    assert.equal(p.state,'not-configured')
    const checked=await request(p.id+'/test',{method:'POST'})
    assert.equal(checked.status,200)
    assert.equal((await checked.json()).status.state,'available')
    const rows=(await (await request()).json()).profiles
    assert.equal(rows.length,1)
    assert.equal(rows[0].state,'available')
    const missing=await request('',{method:'POST',body:JSON.stringify({
      projectId:'morkahja',kind:'local-files',displayName:'Missing',target:dir+'/not-found',
    })})
    const missingId=(await missing.json()).profile.id
    const miss=(await (await request(missingId+'/test',{method:'POST'})).json()).status
    assert.equal(miss.state,'error')
    const remote=await request('',{method:'POST',body:JSON.stringify({
      projectId:'babuni-dev',kind:'github',displayName:'GitHub',target:'babunidev/test',
    })})
    const remoteId=(await remote.json()).profile.id
    const checkRemote=(await (await request(remoteId+'/test',{method:'POST'})).json()).status
    assert.equal(checkRemote.state,'not-configured')
    assert.equal((await request(p.id,{method:'DELETE'})).status,200)
    assert.equal((await (await request()).json()).profiles.length,2)
  } finally{
    child.kill('SIGTERM')
    await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r)})
    rmSync(dir,{recursive:true,force:true})
  }
})
