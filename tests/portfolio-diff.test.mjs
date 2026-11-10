import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { documentDiff, lineDiff } from '../local-service/portfolioDiff.mjs'

const sha = 'abcdef12' + '0'.repeat(32)
function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'babuni-diff-checkout-'))
  mkdirSync(join(dir, 'src/content'), { recursive: true })
  writeFileSync(join(dir, 'src/content/repository-documents.json'), JSON.stringify({
    'babunidev/eldgrim': {
      repository: 'babunidev/eldgrim', branch: 'main', commit: 'f'.repeat(40),
      documents: [{ path: 'README.md', body: 'one\ntwo\nthree\n' }, { path: 'OLD.md', body: 'gone\n' }],
      images: [{ path: 'docs/map.webp', sha: '1' }],
    },
  }))
  writeFileSync(join(dir, 'src/content/project-repositories.json'), JSON.stringify({
    eldgrim: { repository: 'babunidev/eldgrim', branch: 'main', status: 'connected' },
  }))
  return dir
}
const listed = changes => (repository, path) => changes[`${repository}:${path}`] ?? null

test('line diff marks added and removed lines with context', async () => {
  const d = await lineDiff('one\ntwo\nthree\n', 'one\n2\nthree\nfour\n')
  assert.equal(d.added, 2)
  assert.equal(d.removed, 1)
  assert.deepEqual(d.lines.filter(l => l.t !== '@').map(l => l.t + l.s), [' one', '-two', '+2', ' three', '+four'])
  assert.equal(d.truncated, false)
})

test('changed document compares the snapshot with the repository at its current head', async () => {
  const requests = []
  const read = {
    head: async (repo, branch) => { requests.push(['head', repo, branch]); return sha },
    file: async (repo, path, ref) => { requests.push(['file', repo, path, ref]); return 'one\nTWO\nthree\n' },
  }
  const d = await documentDiff('babunidev/eldgrim', 'README.md', {
    checkout: checkout(), read, checked: listed({ 'babunidev/eldgrim:README.md': { kind: 'CHANGED', to: 'abcdef12' } }),
  })
  assert.equal(d.ok, true)
  assert.equal(d.movedSinceCheck, false)
  assert.equal(d.commit, 'abcdef12')
  assert.deepEqual([d.added, d.removed], [1, 1])
  assert.deepEqual(requests, [['head', 'babunidev/eldgrim', 'main'], ['file', 'babunidev/eldgrim', 'README.md', sha]])
})

test('removed and new documents diff against empty text; a moved head is reported', async () => {
  const read = { head: async () => sha, file: async () => 'new\n' }
  const checked = listed({
    'babunidev/eldgrim:OLD.md': { kind: 'REMOVED', to: '99999999' },
    'babunidev/eldgrim:NEW.md': { kind: 'NEW', to: 'abcdef12' },
  })
  const gone = await documentDiff('babunidev/eldgrim', 'OLD.md', { checkout: checkout(), read, checked })
  assert.deepEqual([gone.added, gone.removed, gone.movedSinceCheck], [0, 1, true])
  const fresh = await documentDiff('babunidev/eldgrim', 'NEW.md', { checkout: checkout(), read, checked })
  assert.deepEqual([fresh.added, fresh.removed], [1, 0])
})

test('only documents the last check listed can be compared; images are not diffed', async () => {
  let called = false
  const read = { head: async () => { called = true; return sha }, file: async () => '' }
  await assert.rejects(documentDiff('babunidev/eldgrim', 'README.md', { checkout: checkout(), read, checked: listed({}) }), /CHANGE_NOT_LISTED/)
  await assert.rejects(documentDiff('someone/else', '../../etc/passwd', { checkout: checkout(), read, checked: listed({}) }), /CHANGE_NOT_LISTED/)
  const image = await documentDiff('babunidev/eldgrim', 'docs/map.webp', {
    checkout: checkout(), read, checked: listed({ 'babunidev/eldgrim:docs/map.webp': { kind: 'CHANGED', to: null } }),
  })
  assert.equal(image.binary, true)
  assert.equal(called, false)
})

test('a failed or malformed GitHub read is an error, not an empty diff', async () => {
  const checked = listed({ 'babunidev/eldgrim:README.md': { kind: 'CHANGED', to: 'abcdef12' } })
  await assert.rejects(documentDiff('babunidev/eldgrim', 'README.md', {
    checkout: checkout(), checked, read: { head: async () => { throw new Error('x') }, file: async () => '' },
  }), /GITHUB_READ_FAILED/)
  await assert.rejects(documentDiff('babunidev/eldgrim', 'README.md', {
    checkout: checkout(), checked, read: { head: async () => 'not-a-sha', file: async () => '' },
  }), /GITHUB_READ_FAILED/)
})
