import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PORTFOLIO_GITHUB_REPO,
  PORTFOLIO_LIVE_HOST,
  probeBabuniDevConnection,
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
