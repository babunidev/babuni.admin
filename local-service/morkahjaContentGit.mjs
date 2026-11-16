import { execFile } from 'node:child_process'
import { readFile, writeFile, access, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

const FILES = {
  encounters: 'encountersdata.json',
  solutions: 'solutiondata.json',
  expansions: 'expansiondata.json',
  frames: 'frames.json',
  portraits: 'portraits.json',
}
const BRANCH = 'morkahja-content-edits'
// Same folders as the live server, inside the game repository's client/public.
const IMAGE_FOLDERS = {
  encounter: 'game/encounterimages',
  solution: 'game/solutionimages',
  expansion: 'UI/03_DASHBOARD/expansions',
  frame: 'UI/02_AvatarCreation/Frames',
  portrait: 'UI/02_AvatarCreation/Avatare',
}
const IMAGE_LABELS = {
  encounter: 'encounter image', solution: 'solution icon', expansion: 'expansion image',
  frame: 'frame image', portrait: 'portrait image',
}

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

function enqueue(task) {
  const run = queue.then(task)
  queue = run.then(() => {}, () => {})
  return run
}

export function commitMorkahjaContent(edit, options = {}) {
  let relative
  try { relative = catalogPath(edit.kind) } catch { return Promise.resolve({ ok: false, code: 'CONTENT_INVALID_REQUEST' }) }
  return enqueue(() => commitFile(options, relative, async (file) => {
    const current = JSON.parse(await readFile(file, 'utf8'))
    const before = JSON.stringify(current)
    const added = applyRecord(edit.kind, String(edit.key), edit.data, current)
    const next = `${JSON.stringify(current, null, 2)}\n`
    if (before === JSON.stringify(JSON.parse(next))) return null
    await writeFile(file, next)
    return commitMessage(edit.kind, edit.key, edit.data, added)
  }))
}

/** Commits one uploaded WebP into client/public so the next frontend release keeps it. */
export function commitMorkahjaImage(image, options = {}) {
  const folder = IMAGE_FOLDERS[image.kind]
  if (!folder || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}\.webp$/.test(image.name) || !Buffer.isBuffer(image.bytes)) {
    return Promise.resolve({ ok: false, code: 'CONTENT_INVALID_REQUEST' })
  }
  return enqueue(() => commitFile(options, join('client', 'public', folder, image.name), async (file) => {
    let previous = null
    try { previous = await readFile(file) } catch { /* new image */ }
    if (previous && previous.equals(image.bytes)) return null
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, image.bytes)
    return `Admin: ${previous ? 'replace' : 'add'} ${IMAGE_LABELS[image.kind]} ${image.name}`
  }))
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

async function commitFile(options, relative, update) {
  const repo = options.repo || process.env.MORKAHJA_CONTENT_REPO || '/home/babuni/Projects/MorkahjaWebApp'
  const worktree = options.worktree || process.env.MORKAHJA_CONTENT_WORKTREE || '/home/babuni/Projects/Morkahja-content-commits'
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
    const message = await update(file)
    if (!message) return { ok: true, skipped: true }
    await git(['add', '--', relative], worktree)
    await git(['commit', '-q', '-m', message, '--only', '--', relative], worktree)
    if (options.push !== false) await pushMain(worktree)
    const commit = await git(['rev-parse', '--short', 'HEAD'], worktree)
    const full = await git(['rev-parse', 'HEAD'], worktree)
    const remote = await git(['remote', 'get-url', 'origin'], worktree).catch(() => '')
    const web = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote)
    return { ok: true, commit, message, ...(web ? { url: `https://github.com/${web[1]}/commit/${full}` } : {}) }
  } catch (error) {
    const stderr = error?.stderr || ''
    if (/non-fast-forward|rejected|fetch first/i.test(stderr)) return { ok: false, code: 'CONTENT_GIT_PUSH_FAILED' }
    console.error('Morkahja content commit failed:', error?.stderr || error?.message || error)
    return { ok: false, code: 'CONTENT_GIT_FAILED' }
  }
}
