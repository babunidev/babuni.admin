import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PORTFOLIO_GITHUB_REPO,
  PORTFOLIO_LIVE_HOST,
  probeBabuniDevConnection,
  checkBabuniDevAdministrator,
} from '../local-service/babuniDevConnections.mjs'

const github = { projectId: 'babuni-dev', kind: 'github', target: PORTFOLIO_GITHUB_REPO }
const site = { projectId: 'babuni-dev', kind: 'remote-publish', target: PORTFOLIO_LIVE_HOST }

test('approved GitHub profile reads authenticated metadata without writing', async () => {
  let calls = 0
  const status = await probeBabuniDevConnection(github, {}, {
    githubLookup: async () => {
      calls++
      return { full_name: PORTFOLIO_GITHUB_REPO, default_branch: 'main' }
    },
  })
  assert.equal(calls, 1)
  assert.equal(status.state, 'available')
  assert.equal(status.code, 'GITHUB_READ_VERIFIED')
  assert.match(status.detail, /No editing permission was tested or granted/)
  assert.equal(typeof status.lastSuccessAt, 'string')
})

test('approved canonical website profile checks HTML HTTPS only', async () => {
  let calls = 0
  const status = await probeBabuniDevConnection(site, {}, {
    websiteLookup: async () => { calls++; return { status: 200, contentType: 'text/html; charset=utf-8' } },
  })
  assert.equal(calls, 1)
  assert.equal(status.state, 'available')
  assert.equal(status.code, 'WEBSITE_HTTPS_AVAILABLE')
  assert.match(status.detail, /does not verify deployed revision/)
})

test('out-of-scope repositories, arbitrary hosts, and other projects never trigger network reads', async () => {
  let calls = 0
  const dependencies = {
    githubLookup: async () => { calls++; throw Error('should not run') },
    websiteLookup: async () => { calls++; throw Error('should not run') },
  }
  const candidates = [
    { ...github, target: 'babunidev/other-repo' },
    { ...github, target: 'babunidev/babuni.dev/../../other' },
    { ...github, projectId: 'morkahja' },
    { ...site, target: 'localhost' },
    { ...site, target: 'www.babuni.dev.attacker.invalid' },
    { ...site, kind: 'github' },
  ]
  for (const profile of candidates) {
    const status = await probeBabuniDevConnection(profile, {}, dependencies)
    assert.equal(status.state, 'error')
    assert.match(status.code, /DENIED/)
  }
  assert.equal(calls, 0)
})

test('read probes report failures safely and preserve last confirmed success', async () => {
  const prior = { lastSuccessAt: '2026-01-01T00:00:00.000Z' }
  const failedGithub = await probeBabuniDevConnection(github, prior, {
    githubLookup: async () => { throw Error('sensitive stderr contents') },
  })
  assert.equal(failedGithub.code, 'GITHUB_READ_FAILED')
  assert.equal(failedGithub.lastSuccessAt, prior.lastSuccessAt)
  assert.doesNotMatch(JSON.stringify(failedGithub), /sensitive stderr contents/)
  const wrongRepo = await probeBabuniDevConnection(github, prior, {
    githubLookup: async () => ({ full_name: 'babunidev/other', default_branch: 'main' }),
  })
  assert.equal(wrongRepo.code, 'GITHUB_INVALID_RESPONSE')
  const wrongSite = await probeBabuniDevConnection(site, prior, {
    websiteLookup: async () => ({ status: 301, contentType: 'text/html' }),
  })
  assert.equal(wrongSite.code, 'WEBSITE_UNEXPECTED_RESPONSE')
  const unavailableSite = await probeBabuniDevConnection(site, prior, {
    websiteLookup: async () => { throw Error('certificate content secret') },
  })
  assert.equal(unavailableSite.code, 'WEBSITE_UNREACHABLE')
  assert.doesNotMatch(JSON.stringify(unavailableSite), /certificate content secret/)
})

test('one portfolio administrator inherits approved host identity but no write capability', async () => {
  let sshCalls=0
  const profile={projectId:'morkahja',kind:'postgres-ssh-moderation',target:'owner.example.invalid'}
  const options={
    githubLookup:async()=>({full_name:PORTFOLIO_GITHUB_REPO,default_branch:'main'}),
    websiteLookup:async()=>({status:200,contentType:'text/html'}),
    readConfig:async()=>({ok:true,config:{host:profile.target,sshUser:'operator'}}),
    sshLookup:async config=>{sshCalls++;assert.equal(config.host,profile.target)
      return {ok:true,code:'PORTFOLIO_SSH_READ_VERIFIED'}},
  }
  const status=await checkBabuniDevAdministrator(profile,options)
  assert.equal(status.ok,true)
  assert.equal(status.code,'PORTFOLIO_READ_CONNECTION_READY')
  assert.equal(status.publishingEnabled,false)
  assert.equal(status.host,profile.target)
  assert.equal(status.github.code,'GITHUB_READ_VERIFIED')
  assert.equal(status.website.code,'WEBSITE_HTTPS_AVAILABLE')
  assert.equal(status.ssh.code,'PORTFOLIO_SSH_READ_VERIFIED')
  assert.equal(sshCalls,1)
  const denied=await checkBabuniDevAdministrator({...profile,kind:'postgres-ssh'},options)
  assert.equal(denied.code,'ADMIN_CONNECTION_MISSING')
  assert.equal(sshCalls,1)
})

test('portfolio administrator shows independent GitHub, HTTPS and SSH failure states', async () => {
  const profile={projectId:'morkahja',kind:'postgres-ssh-moderation',target:'owner.example.invalid'}
  const status=await checkBabuniDevAdministrator(profile,{
    githubLookup:async()=>{throw Error('private auth message')},
    websiteLookup:async()=>({status:404,contentType:'text/html'}),
    readConfig:async()=>({ok:false,code:'SSH_FINGERPRINT_MISMATCH'}),
    sshLookup:async()=>{throw Error('should not run')},
  })
  assert.equal(status.ok,false)
  assert.equal(status.github.code,'GITHUB_READ_FAILED')
  assert.equal(status.website.code,'WEBSITE_UNEXPECTED_RESPONSE')
  assert.equal(status.ssh.code,'SSH_FINGERPRINT_MISMATCH')
  assert.equal(status.publishingEnabled,false)
  assert.doesNotMatch(JSON.stringify(status),/private auth message/)
})
