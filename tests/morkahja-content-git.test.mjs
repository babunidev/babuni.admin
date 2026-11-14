import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { commitMorkahjaContent } from '../local-service/morkahjaContentGit.mjs'

const git = (args, cwd) => new Promise((resolve, reject) => {
  execFile('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (error, stdout, stderr) => {
    if (error) reject(new Error(stderr || error.message))
    else resolve(String(stdout).trim())
  })
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'morkahja-content-git-'))
  const bare = join(root, 'remote.git')
  const repo = join(root, 'repo')
  const worktree = join(root, 'commits')
  await git(['init', '--bare', '-b', 'main', bare], root)
  await git(['init', '-b', 'main', repo], root)
  await git(['config', 'user.name', 'Babunigaming'], repo)
  await git(['config', 'user.email', 'babunigaming@example.com'], repo)
  await mkdir(join(repo, 'server', 'game'), { recursive: true })
  const catalog = {
    19001: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'Old story' },
  }
  await writeFile(join(repo, 'server', 'game', 'encountersdata.json'), `${JSON.stringify(catalog, null, 2)}\n`)
  await writeFile(join(repo, 'notes.txt'), 'keep\n')
  await git(['add', '.'], repo)
  await git(['commit', '-q', '-m', 'seed'], repo)
  await git(['remote', 'add', 'origin', bare], repo)
  await git(['push', '-q', 'origin', 'HEAD:main'], repo)
  return { root, bare, repo, worktree }
}

test('a content save commits and pushes only that catalog record', async () => {
  const { root, bare, repo, worktree } = await fixture()
  try {
    const saved = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo, worktree })
    assert.equal(saved.ok, true)
    assert.match(saved.message, /^Admin: update encounter 19001 \(Verdani’s Vigil\)$/)
    const subject = await git(['log', '-1', '--format=%s'], bare)
    assert.equal(subject, saved.message)
    const published = JSON.parse(await git(['show', 'HEAD:server/game/encountersdata.json'], bare))
    assert.equal(published['19001'].mEncounterText, 'New story')
    const files = await git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], bare)
    assert.equal(files, 'server/game/encountersdata.json')
    assert.equal(await git(['status', '--porcelain'], repo), '')
    assert.equal(await git(['branch', '--show-current'], repo), 'main')

    const again = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo, worktree })
    assert.equal(again.skipped, true)
    assert.equal(await git(['rev-list', '--count', 'HEAD'], bare), '2')
  } finally {
    await git(['worktree', 'remove', '--force', worktree], repo).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
})

test('a dirty worktree is not committed', async () => {
  const { root, bare, repo, worktree } = await fixture()
  try {
    await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo, worktree })
    await writeFile(join(worktree, 'notes.txt'), 'dirty\n')
    const blocked = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'Another story' },
    }, { repo, worktree })
    assert.equal(blocked.code, 'CONTENT_GIT_DIRTY')
    const published = JSON.parse(await git(['show', 'HEAD:server/game/encountersdata.json'], bare))
    assert.equal(published['19001'].mEncounterText, 'New story')
    assert.equal(await readFile(join(worktree, 'server', 'game', 'encountersdata.json'), 'utf8').then(text => text.includes('Another story')), false)
  } finally {
    await git(['worktree', 'remove', '--force', worktree], repo).catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
})
