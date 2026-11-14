import { execFile } from 'node:child_process'
import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const FILES = {
  encounters: 'encountersdata.json',
  solutions: 'solutiondata.json',
  expansions: 'expansiondata.json',
  frames: 'frames.json',
  portraits: 'portraits.json',
}
const BRANCH = 'morkahja-content-edits'

const git = (args, cwd, timeout = 30000) => new Promise((resolve, reject) => {
  execFile('git', args, {
    cwd, timeout, maxBuffer: 8 << 20,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }, (error, stdout, stderr) => {
    if (error) {
      const failure = new Error('GIT_FAILED')
      failure.stderr = String(stderr || error.message || '').slice(0, 500)
      reject(failure)
      return
    }
    resolve(String(stdout).trim())
  })
})

let queue = Promise.resolve()

export function commitMorkahjaContent(edit, options = {}) {
  const run = queue.then(() => commitUnlocked(edit, options))
  queue = run.then(() => {}, () => {})
  return run
}

function catalogPath(kind) {
  const file = FILES[kind]
  if (!file) throw Object.assign(new Error('CONTENT_INVALID_REQUEST'), { code: 'CONTENT_INVALID_REQUEST' })
  return join('server', 'game', file)
}

function commitMessage(kind, key, data, added) {
  const verb = added ? 'add' : 'update'
  if (kind === 'encounters') {
    const title = cleanLabel(data?.mEncounterTitle)
    const id = data?.mEncounterID ?? key
    return title ? `Admin: ${verb} encounter ${id} (${title})` : `Admin: ${verb} encounter ${id}`
  }
  if (kind === 'solutions') {
    const title = cleanLabel(data?.mSolutionName)
    const id = data?.mSolutionID ?? key
    return title ? `Admin: ${verb} solution ${id} (${title})` : `Admin: ${verb} solution ${id}`
  }
  if (kind === 'expansions') {
    const title = cleanLabel(data?.mExtensioName)
    const id = data?.mExtensioID ?? key
    return title ? `Admin: ${verb} expansion ${id} (${title})` : `Admin: ${verb} expansion ${id}`
  }
  if (kind === 'frames') return `Admin: ${verb} frame ${data?.frameID ?? key}`
  return `Admin: ${verb} portrait ${data?.avatarID ?? key}`
}

function cleanLabel(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 120)
}

function applyRecord(kind, key, record, data) {
  if (kind === 'encounters' || kind === 'solutions') {
    const added = !Object.hasOwn(data, key)
    data[key] = record
    return added
  }
  if (kind === 'expansions') {
    if (!data.expansions || typeof data.expansions !== 'object') {
      throw Object.assign(new Error('CONTENT_INVALID_SCHEMA'), { code: 'CONTENT_INVALID_SCHEMA' })
    }
    const added = !Object.hasOwn(data.expansions, key)
    data.expansions[key] = record
    return added
  }
  const field = kind === 'frames' ? 'Frames' : 'Avatar'
  if (!Array.isArray(data[field])) {
    throw Object.assign(new Error('CONTENT_INVALID_SCHEMA'), { code: 'CONTENT_INVALID_SCHEMA' })
  }
  const index = Number(key)
  const added = data[field][index] == null
  while (data[field].length <= index) data[field].push(null)
  data[field][index] = record
  return added
}

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

async function ensureWorktree(repo, worktree) {
  if (await exists(join(worktree, '.git'))) return
  await git(['worktree', 'prune'], repo)
  await git(['fetch', '-q', 'origin', 'main'], repo, 60000)
  let branchExists = true
  try { await git(['rev-parse', '--verify', '--quiet', BRANCH], repo) }
  catch { branchExists = false }
  if (branchExists) await git(['worktree', 'add', worktree, BRANCH], repo)
  else await git(['worktree', 'add', '-b', BRANCH, worktree, 'origin/main'], repo)
}

function changedPaths(status) {
  return status.split('\n').filter(Boolean).map((line) => {
    const body = line.slice(3)
    const arrow = body.lastIndexOf(' -> ')
    return arrow >= 0 ? body.slice(arrow + 4) : body
  })
}

async function pushMain(worktree) {
  try {
    await git(['push', '-q', 'origin', 'HEAD:main'], worktree, 120000)
  } catch (error) {
    if (!/non-fast-forward|rejected|fetch first/i.test(error?.stderr || '')) throw error
    await git(['fetch', '-q', 'origin', 'main'], worktree, 60000)
    try { await git(['rebase', 'origin/main'], worktree) }
    catch (rebaseError) {
      await git(['rebase', '--abort'], worktree).catch(() => {})
      throw rebaseError
    }
    await git(['push', '-q', 'origin', 'HEAD:main'], worktree, 120000)
  }
}

async function commitUnlocked(edit, options) {
  const repo = options.repo || process.env.MORKAHJA_CONTENT_REPO || '/home/babuni/Projects/MorkahjaWebApp'
  const worktree = options.worktree || process.env.MORKAHJA_CONTENT_WORKTREE || '/home/babuni/Projects/Morkahja-content-commits'
  const relative = catalogPath(edit.kind)
  const file = join(worktree, relative)
  try {
    await ensureWorktree(repo, worktree)
    await git(['fetch', '-q', 'origin', 'main'], worktree, 60000)
    const dirty = changedPaths(await git(['status', '--porcelain', '--untracked-files=no'], worktree))
      .filter(path => path !== relative)
    if (dirty.length > 0) return { ok: false, code: 'CONTENT_GIT_DIRTY' }
    try { await git(['merge', '--ff-only', 'origin/main'], worktree) }
    catch {
      try { await git(['rebase', 'origin/main'], worktree) }
      catch {
        await git(['rebase', '--abort'], worktree).catch(() => {})
        return { ok: false, code: 'CONTENT_GIT_DIVERGED' }
      }
    }
    const current = JSON.parse(await readFile(file, 'utf8'))
    const before = JSON.stringify(current)
    const added = applyRecord(edit.kind, String(edit.key), edit.data, current)
    const next = `${JSON.stringify(current, null, 2)}\n`
    if (before === JSON.stringify(JSON.parse(next))) return { ok: true, skipped: true }
    await writeFile(file, next)
    await git(['add', '--', relative], worktree)
    const message = commitMessage(edit.kind, edit.key, edit.data, added)
    await git(['commit', '-q', '-m', message, '--only', '--', relative], worktree)
    if (options.push !== false) await pushMain(worktree)
    const commit = await git(['rev-parse', '--short', 'HEAD'], worktree)
    return { ok: true, commit, message }
  } catch (error) {
    const stderr = error?.stderr || ''
    if (/non-fast-forward|rejected|fetch first/i.test(stderr)) return { ok: false, code: 'CONTENT_GIT_PUSH_FAILED' }
    console.error('Morkahja content commit failed:', error?.stderr || error?.message || error)
    return { ok: false, code: 'CONTENT_GIT_FAILED' }
  }
}
