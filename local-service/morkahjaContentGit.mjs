import { execFile } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

const FILES = {
  encounters: 'encountersdata.json',
  solutions: 'solutiondata.json',
  expansions: 'expansiondata.json',
  frames: 'frames.json',
  portraits: 'portraits.json',
}
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

/**
 * Babuni's game checkout, on main: the one place the game lives locally
 * (creative decision 2026-11-21: one MorkahjaWebApp project, no side checkout,
 * no content branch). A save lands there, so the local game has it at once,
 * and is pushed from there to GitHub main.
 */
function gameRepo(options) {
  return options.repo
    || process.env.MORKAHJA_CONTENT_REPO
    || process.env.MORKAHJA_GAME_REPO
    || '/home/babuni/Projects/MorkahjaWebApp'
}

/** `[behind, ahead]` of local main against GitHub main. */
async function divergence(repo) {
  const counts = await git(['rev-list', '--left-right', '--count', 'origin/main...HEAD'], repo)
  const [behind, ahead] = counts.split(/\s+/).map(Number)
  return [behind || 0, ahead || 0]
}

async function commitFile(options, relative, update) {
  const repo = gameRepo(options)
  const file = join(repo, relative)
  try {
    if (await git(['branch', '--show-current'], repo) !== 'main') return { ok: false, code: 'CONTENT_GIT_NOT_MAIN' }

    // Catch up with GitHub first when local main is simply behind. Babuni's
    // checkout is never rebased or reset; git refuses a fast-forward that would
    // touch their uncommitted edits, and then nothing is written.
    let unpublished = 0
    let offline = false
    try {
      await git(['fetch', '-q', 'origin', 'main'], repo, 60000)
      const [behind, ahead] = await divergence(repo)
      if (behind > 0 && ahead > 0) return { ok: false, code: 'CONTENT_GIT_DIVERGED' }
      if (behind > 0) {
        try { await git(['merge', '--ff-only', '-q', 'origin/main'], repo) }
        catch { return { ok: false, code: 'CONTENT_GIT_BEHIND' } }
      }
      unpublished = ahead
    } catch {
      offline = true
    }

    const message = await update(file)
    if (!message) return { ok: true, skipped: true }
    await git(['add', '--', relative], repo)
    // Only this file; whatever else Babuni has staged or changed stays as it is.
    await git(['commit', '-q', '-m', message, '--only', '--', relative], repo)
    const commit = await git(['rev-parse', '--short', 'HEAD'], repo)
    const full = await git(['rev-parse', 'HEAD'], repo)
    const remote = await git(['remote', 'get-url', 'origin'], repo).catch(() => '')
    const web = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote)
    const result = { ok: true, commit, message, ...(web ? { url: `https://github.com/${web[1]}/commit/${full}` } : {}) }

    // Local main's own unpublished commits are Babuni's to push; never send them along.
    if (options.push === false) return { ...result, pushed: false }
    if (offline) return { ...result, pushed: false, code: 'CONTENT_GIT_OFFLINE' }
    if (unpublished > 0) return { ...result, pushed: false, code: 'CONTENT_GIT_UNPUBLISHED', unpublished }
    try {
      await git(['push', '-q', 'origin', 'HEAD:main'], repo, 120000)
    } catch {
      return { ...result, pushed: false, code: 'CONTENT_GIT_PUSH_FAILED' }
    }
    return { ...result, pushed: true }
  } catch (error) {
    console.error('Morkahja content commit failed:', error?.stderr || error?.message || error)
    return { ok: false, code: 'CONTENT_GIT_FAILED' }
  }
}
