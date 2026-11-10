import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, linkSync, symlinkSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildReleaseScript, planReleaseCleanup, applyReleaseCleanup, setReleaseClock, RELEASE_NAME,
} from '../local-service/portfolioReleases.mjs'
import { withPublishLock } from '../local-service/publishLock.mjs'

const names = [
  '20261101-100000-aaaaaaa-site', '20261102-100000-bbbbbbb-doc', '20261103-100000-ccccccc-site',
  '20261104-100000-ddddddd-site', '20261105-100000-eeeeeee-doc', '20261106-100000-fffffff-site',
  '20261107-100000-1111111-site', '20261108-100000-2222222-site',
]

/** A fake /var/www/babuni.dev: releases share one hard-linked file, and each has one own file. */
function fakeRoot(liveIndex) {
  const root = mkdtempSync(join(tmpdir(), 'babuni-releases-'))
  mkdirSync(join(root, 'releases'))
  const shared = join(root, 'shared.bin')
  writeFileSync(shared, Buffer.alloc(8192, 1))
  for (const n of names) {
    mkdirSync(join(root, 'releases', n, 'assets'), { recursive: true })
    linkSync(shared, join(root, 'releases', n, 'assets', 'shared.bin'))
    writeFileSync(join(root, 'releases', n, 'index.html'), Buffer.alloc(4096, 2))
  }
  writeFileSync(join(root, 'releases', 'notes.txt'), 'not a release')
  symlinkSync(`releases/${names[liveIndex]}`, join(root, 'current'))
  return root
}
const runLocal = script => {
  const r = spawnSync('python3', ['-'], { input: script, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return JSON.parse(r.stdout)
}

test('plan keeps the live release, its predecessor, newer ones and the newest five', () => {
  const root = fakeRoot(2) // live is the third; two newer releases exist after a rollback
  const plan = runLocal(buildReleaseScript({ root, keep: 5 }))
  assert.equal(plan.ok, true)
  assert.equal(plan.current, names[2])
  assert.equal(plan.previous, names[1])
  assert.deepEqual(plan.remove, [names[0]])
  assert.ok(plan.keep.includes(names[1]) && plan.keep.includes(names[2]))
  assert.deepEqual(plan.other, ['notes.txt'])
  // The shared hard-linked file stays in kept releases, so only the own file is freed.
  assert.ok(plan.freedBytes >= 4096 && plan.freedBytes < 8192)
})

test('cleanup removes exactly the planned releases and nothing else', () => {
  const root = fakeRoot(7)
  const plan = runLocal(buildReleaseScript({ root, keep: 5 }))
  assert.deepEqual(plan.remove, names.slice(0, 3))
  const done = runLocal(buildReleaseScript({ root, keep: 5, remove: plan.remove, expectCurrent: plan.current }))
  assert.equal(done.ok, true)
  assert.deepEqual(done.removed, names.slice(0, 3))
  assert.deepEqual(readdirSync(join(root, 'releases')).sort(), [...names.slice(3), 'notes.txt'].sort())
  assert.ok(existsSync(join(root, 'shared.bin')))
})

test('cleanup refuses when the live release changed since the check', () => {
  const root = fakeRoot(7)
  const result = runLocal(buildReleaseScript({ root, remove: [names[0]], expectCurrent: names[6] }))
  assert.deepEqual(result, { ok: false, code: 'PLAN_STALE' })
  assert.ok(existsSync(join(root, 'releases', names[0])))
})

test('cleanup refuses to remove a release the server would keep', () => {
  const root = fakeRoot(7)
  const result = runLocal(buildReleaseScript({ root, remove: [names[6]], expectCurrent: names[7] }))
  assert.equal(result.code, 'PLAN_STALE')
  assert.ok(existsSync(join(root, 'releases', names[6])))
})

test('a live link outside the releases folder stops everything', () => {
  const root = fakeRoot(7)
  const result = runLocal(buildReleaseScript({ root: join(root, 'missing') }))
  assert.equal(result.ok, false)
})

test('only release names reach the script', () => {
  assert.throws(() => buildReleaseScript({ remove: ['../etc'], expectCurrent: names[0] }), /RELEASE_NAME_INVALID/)
  assert.throws(() => buildReleaseScript({ remove: [], expectCurrent: 'x"; import os' }), /RELEASE_NAME_INVALID/)
  assert.ok(RELEASE_NAME.test('20261110-052014-6f4f44a-site'))
  assert.ok(!RELEASE_NAME.test('20261110-052014-6f4f44a-site/..'))
})

const deployTarget = async () => ({ ok: true, config: {} })
const planResponse = { ok: true, current: names[7], previous: names[6], keep: names.slice(3), remove: names.slice(0, 3), freedBytes: 1234, other: [] }

test('apply needs a recent check and sends only that check’s names', async () => {
  let t = 1_000_000
  setReleaseClock(() => t)
  await assert.rejects(applyReleaseCleanup({}, { deployTarget }), /CHECK_REQUIRED/)
  const sent = []
  const runPython = async (_config, script) => {
    sent.push(script)
    return sent.length === 1 ? planResponse : { ok: true, current: names[7], removed: names.slice(0, 3), freedBytes: 1234 }
  }
  const plan = await planReleaseCleanup({}, { deployTarget, runPython })
  assert.equal(plan.ok, true)
  assert.deepEqual(plan.remove, names.slice(0, 3))
  const done = await applyReleaseCleanup({}, { deployTarget, runPython })
  assert.equal(done.ok, true)
  assert.match(sent[1], new RegExp(`REMOVE = \\["${names[0]}","${names[1]}","${names[2]}"\\]`))
  assert.match(sent[1], new RegExp(`EXPECT = "${names[7]}"`))
  // The check is used up.
  await assert.rejects(applyReleaseCleanup({}, { deployTarget, runPython }), /CHECK_REQUIRED/)
  // An old check expires.
  await planReleaseCleanup({}, { deployTarget, runPython: async () => planResponse })
  t += 11 * 60 * 1000
  await assert.rejects(applyReleaseCleanup({}, { deployTarget, runPython }), /CHECK_REQUIRED/)
})

test('a response that would remove the live or rollback release is rejected', async () => {
  setReleaseClock(() => 0)
  for (const remove of [[names[7]], [names[6]], ['../x']]) {
    const plan = await planReleaseCleanup({}, { deployTarget, runPython: async () => ({ ...planResponse, remove }) })
    assert.deepEqual(plan, { ok: false, error: 'RELEASES_INVALID_RESPONSE' })
    await assert.rejects(applyReleaseCleanup({}, { deployTarget }), /CHECK_REQUIRED/)
  }
})

test('missing deploy access and a busy publish stop before any SSH call', async () => {
  setReleaseClock(() => 0)
  let called = false
  const runPython = async () => { called = true; return planResponse }
  const denied = await planReleaseCleanup({}, { deployTarget: async () => ({ ok: false, code: 'PORTFOLIO_DEPLOY_KEY_UNAVAILABLE' }), runPython })
  assert.deepEqual(denied, { ok: false, error: 'PORTFOLIO_DEPLOY_KEY_UNAVAILABLE' })
  await withPublishLock('site-publish', async () => {
    await assert.rejects(planReleaseCleanup({}, { deployTarget, runPython }), /PUBLISH_BUSY/)
  })
  assert.equal(called, false)
})
