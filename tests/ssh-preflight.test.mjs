import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,rmSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {preflightSshHost,validSshHostname} from '../local-service/sshHostPreflight.mjs'

test('SSH host preflight requires a private exact trust entry; never opens a connection',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'babuni-ssh-offline-'))
  const key=join(dir,'fixture-host-key')
  const trust=join(dir,'known_hosts')
  const profile={projectId:'morkahja',kind:'postgres-ssh',target:'morkahja.example.invalid'}
  const original=process.env.BABUNI_SSH_KNOWN_HOSTS
  try {
    execFileSync('ssh-keygen',['-q','-t','ed25519','-N','','-f',key],{stdio:'ignore'})
    const pub=readFileSync(key+'.pub','utf8').trim().split(/\s+/)
    const entry=`${profile.target} ${pub[0]} ${pub[1]}\n`
    process.env.BABUNI_SSH_KNOWN_HOSTS=trust
    assert.equal((await preflightSshHost(profile)).code,'SSH_TRUST_STORE_MISSING')
    writeFileSync(trust,`*.example.invalid ${pub[0]} ${pub[1]}\n`,{mode:0o600})
    assert.equal((await preflightSshHost(profile)).code,'SSH_HOST_NOT_PINNED')
    writeFileSync(trust,`another.example.invalid ${pub[0]} ${pub[1]}\n`)
    assert.equal((await preflightSshHost(profile)).code,'SSH_HOST_NOT_PINNED')
    writeFileSync(trust,profile.target+' ssh-ed25519 '+('A'.repeat(64))+'\\n')
    assert.equal((await preflightSshHost(profile)).code,'SSH_HOST_NOT_PINNED')
    writeFileSync(trust,entry)
    const checked=await preflightSshHost(profile)
    assert.equal(checked.code,'SSH_HOST_KEY_PINNED_OFFLINE')
    assert.equal(checked.state,'not-configured')
    assert.match(checked.detail,/no SSH or database connection/i)
    assert.equal('lastSuccessAt' in checked,false)
    assert.equal((await preflightSshHost({...profile,projectId:'babuni-dev'})).code,'ADAPTER_NOT_IMPLEMENTED')
    assert.equal((await preflightSshHost({...profile,target:'-oProxyCommand=evil'})).code,'SSH_HOST_INVALID')
    assert.equal((await preflightSshHost({...profile,target:'bad..host'})).code,'SSH_HOST_INVALID')
    chmodSync(trust,0o666)
    assert.equal((await preflightSshHost(profile)).code,'SSH_TRUST_STORE_UNSAFE')
    chmodSync(trust,0o600)
    const alias=join(dir,'link')
    symlinkSync(trust,alias)
    process.env.BABUNI_SSH_KNOWN_HOSTS=alias
    assert.equal((await preflightSshHost(profile)).code,'SSH_TRUST_STORE_UNSAFE')
    process.env.BABUNI_SSH_KNOWN_HOSTS='relative/trust'
    assert.equal((await preflightSshHost(profile)).code,'SSH_TRUST_STORE_UNSAFE')
    assert.equal(validSshHostname('morkahja.example.invalid'),true)
    assert.equal(validSshHostname('localhost'),false)
  }finally {
    if(original===undefined)delete process.env.BABUNI_SSH_KNOWN_HOSTS
    else process.env.BABUNI_SSH_KNOWN_HOSTS=original
    rmSync(dir,{recursive:true,force:true})
  }
})
