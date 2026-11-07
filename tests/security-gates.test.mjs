import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test('project capabilities deny remote adapters and any current write capability',async()=>{
  const vite=await createServer({configFile:false,server:{middlewareMode:true},logLevel:'error'})
  try {
    const {hasCapability,specForProfile}=await vite.ssrLoadModule('/vite/connectionAdapters.ts')
    const local={projectId:'morkahja',kind:'local-files'}
    assert.equal(hasCapability(local,'local:inspect'),true)
    assert.equal(hasCapability(local,'local:connect'),true)
    for(const [kind,projectId,transport,capabilities] of [
      ['postgres-ssh','morkahja','planned',['ssh:preflight','ssh:probe','ssh:read']],
      ['github','babuni-dev','read-only',['github:probe']],
      ['remote-publish','babuni-dev','read-only',['website:probe']],
    ]) {
      const remote={projectId,kind}
      assert.equal(specForProfile(remote).transport,transport)
      assert.deepEqual(specForProfile(remote).capabilities,capabilities)
      for(const op of ['local:inspect','local:connect','remote:read','remote:write','github:write','website:publish']) {
        assert.equal(hasCapability(remote,op),false)
      }
    }
    assert.equal(hasCapability({projectId:'morkahja',kind:'postgres-ssh'},'ssh:preflight'),true)
    assert.equal(hasCapability({projectId:'morkahja',kind:'postgres-ssh'},'ssh:probe'),true)
    assert.equal(hasCapability({projectId:'morkahja',kind:'postgres-ssh'},'ssh:read'),true)
    assert.equal(hasCapability({projectId:'babuni-dev',kind:'postgres-ssh'},'ssh:preflight'),false)
    assert.equal(hasCapability({projectId:'babuni-dev',kind:'postgres-ssh'},'ssh:probe'),false)
    assert.equal(hasCapability({projectId:'babuni-dev',kind:'postgres-ssh'},'ssh:read'),false)
    assert.equal(hasCapability({projectId:'babuni-dev',kind:'github'},'github:probe'),true)
    assert.equal(hasCapability({projectId:'babuni-dev',kind:'remote-publish'},'website:probe'),true)
    assert.equal(hasCapability({projectId:'morkahja',kind:'github'},'github:probe'),false)
    assert.deepEqual(specForProfile({projectId:'morkahja',kind:'postgres-ssh-moderation'}).capabilities,
      ['ssh:preflight','ssh:read','ssh:moderation','ssh:content'])
    assert.deepEqual(specForProfile({projectId:'morkahja',kind:'ssh-content'}).capabilities,
      ['ssh:preflight','ssh:content'])
    assert.equal(hasCapability(local,'local:write'),false)
    assert.equal(specForProfile({projectId:'babuni-dev',kind:'local-files'}),null)
    assert.equal(specForProfile({projectId:'morkahja',kind:'github'}),null)
    assert.equal(specForProfile({projectId:'morkahja',kind:'__proto__'}),null)
  } finally {await vite.close()}
})

test('legacy opt-in HTTP guards reject untrusted host, peer and origins',async()=>{
  const vite=await createServer({configFile:false,server:{middlewareMode:true},logLevel:'error'})
  try {
    const {rejectNonLocalRequest}=await vite.ssrLoadModule('/vite/localRequestGuard.ts')
    function check(headers,remoteAddress='127.0.0.1',method='GET') {
      const response={statusCode:200,setHeader(){},end(body){this.body=body}}
      const rejected=rejectNonLocalRequest({
        headers:{host:'127.0.0.1:5180',...headers},
        socket:{remoteAddress},
        method,
      },response)
      return {rejected,status:response.statusCode}
    }
    assert.equal(check({}).rejected,false)
    assert.equal(check({origin:'http://127.0.0.1:5180'}).rejected,false)
    assert.equal(check({origin:'http://127.0.0.1:5180'},'127.0.0.1','POST').rejected,false)
    assert.equal(check({},'127.0.0.1','POST').rejected,true)
    assert.equal(check({origin:'https://127.0.0.1:5180'},'127.0.0.1','POST').rejected,true)
    for(const invalid of [
      {host:'evil.invalid:5180'},
      {host:'evil.invalid:5180',origin:'http://evil.invalid:5180'},
      {origin:'https://attacker.invalid'},
      {'sec-fetch-site':'cross-site'},
      {'sec-fetch-site':'same-site'},
    ]) {
      const outcome=check(invalid)
      assert.equal(outcome.rejected,true)
      assert.equal(outcome.status,403)
    }
    assert.equal(check({},'192.0.2.9').rejected,true)
  } finally {await vite.close()}
})
