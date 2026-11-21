import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { commitMorkahjaContent, commitMorkahjaImage } from '../local-service/morkahjaContentGit.mjs'

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
  return { root, bare, repo }
}

test('a content save commits and pushes only that catalog record', async () => {
  const { root, bare, repo } = await fixture()
  try {
    const saved = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo })
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
    }, { repo })
    assert.equal(again.skipped, true)
    assert.equal(await git(['rev-list', '--count', 'HEAD'], bare), '2')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a save lands in the game checkout on main, leaving other edits alone', async () => {
  const { root, bare, repo } = await fixture()
  try {
    await writeFile(join(repo, 'notes.txt'), 'my own edit\n')
    const saved = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo })
    assert.equal(saved.ok, true)
    assert.equal(saved.pushed, true)
    // The local game has it at once, in the working tree and in main's history.
    const local = JSON.parse(await readFile(join(repo, 'server', 'game', 'encountersdata.json'), 'utf8'))
    assert.equal(local['19001'].mEncounterText, 'New story')
    assert.equal(await git(['rev-parse', 'HEAD'], repo), await git(['rev-parse', 'HEAD'], bare))
    // Babuni's uncommitted edit stays uncommitted.
    assert.equal(await git(['status', '--porcelain'], repo), 'M notes.txt')
    assert.equal(await git(['show', 'HEAD:notes.txt'], bare), 'keep')
    // No side checkout, no content branch.
    assert.equal((await git(['worktree', 'list'], repo)).split('\n').length, 1)
    assert.equal(await git(['branch', '--format=%(refname:short)'], repo), 'main')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('local main first catches up with GitHub', async () => {
  const { root, bare, repo } = await fixture()
  const other = join(root, 'other')
  try {
    await git(['clone', '-q', '-b', 'main', bare, other], root)
    await git(['config', 'user.name', 'Other'], other)
    await git(['config', 'user.email', 'other@example.com'], other)
    await writeFile(join(other, 'notes.txt'), 'from github\n')
    await git(['commit', '-q', '-am', 'elsewhere'], other)
    await git(['push', '-q', 'origin', 'HEAD:main'], other)
    const saved = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo })
    assert.equal(saved.pushed, true)
    assert.equal(await readFile(join(repo, 'notes.txt'), 'utf8'), 'from github\n')
    assert.equal(await git(['rev-list', '--count', 'HEAD'], bare), '3')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('local commits not yet on GitHub are never pushed along', async () => {
  const { root, bare, repo } = await fixture()
  try {
    await writeFile(join(repo, 'notes.txt'), 'unpublished\n')
    await git(['commit', '-q', '-am', 'my unpublished work'], repo)
    const saved = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo })
    assert.equal(saved.ok, true)
    assert.equal(saved.pushed, false)
    assert.equal(saved.code, 'CONTENT_GIT_UNPUBLISHED')
    assert.equal(await git(['rev-list', '--count', 'HEAD'], bare), '1')
    assert.equal(await git(['rev-list', '--count', 'HEAD'], repo), '3')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('nothing is written when the game checkout is not on main', async () => {
  const { root, repo } = await fixture()
  try {
    await git(['switch', '-q', '-c', 'elsewhere'], repo)
    const blocked = await commitMorkahjaContent({
      kind: 'encounters',
      key: '19001',
      data: { mEncounterID: 19001, mEncounterTitle: 'Verdani’s Vigil', mEncounterText: 'New story' },
    }, { repo })
    assert.equal(blocked.code, 'CONTENT_GIT_NOT_MAIN')
    const local = await readFile(join(repo, 'server', 'game', 'encountersdata.json'), 'utf8')
    assert.equal(local.includes('New story'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an uploaded image is committed into client/public and pushed', async () => {
  const { root, bare, repo } = await fixture()
  try {
    const bytes = Buffer.from('RIFF\0\0\0\0WEBPpicture')
    const saved = await commitMorkahjaImage({ kind: 'encounter', name: 'moonlit_oasis.webp', bytes }, { repo })
    assert.equal(saved.ok, true)
    assert.equal(saved.message, 'Admin: add encounter image moonlit_oasis.webp')
    const files = await git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], bare)
    assert.equal(files, 'client/public/game/encounterimages/moonlit_oasis.webp')
    const same = await commitMorkahjaImage({ kind: 'encounter', name: 'moonlit_oasis.webp', bytes }, { repo })
    assert.equal(same.skipped, true)
    const replaced = await commitMorkahjaImage({
      kind: 'encounter', name: 'moonlit_oasis.webp', bytes: Buffer.from('RIFF\0\0\0\0WEBPnewer'),
    }, { repo })
    assert.equal(replaced.message, 'Admin: replace encounter image moonlit_oasis.webp')
    const rejected = await commitMorkahjaImage({ kind: 'encounter', name: '../x.webp', bytes }, { repo })
    assert.equal(rejected.code, 'CONTENT_INVALID_REQUEST')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
