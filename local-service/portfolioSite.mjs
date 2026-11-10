import { spawn, execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { checkoutPath } from './portfolioDocuments.mjs'
import { withPublishLock } from './publishLock.mjs'

// Documents from the other connected repositories reach the website in three
// fixed steps, each run from the babuni.dev checkout with a fixed argument list:
//   1. scripts/pull-repository.mjs  updates the pinned snapshot (check, then --write)
//   2. commit and push that one snapshot file to origin/main
//   3. scripts/publish-site.sh      builds origin/main and publishes changed files
const LOCAL = 'babunidev/babuni.dev'
export const SNAPSHOT = 'src/content/repository-documents.json'
const CONNECTIONS = 'src/content/project-repositories.json'
const CHECK_VALID_MS = 60 * 60 * 1000

const ALL_CHECK_CACHE_MS = 10 * 60 * 1000

let lastPullCheck = null
let lastSiteCheck = null
let lastAllCheck = null
/** The change the last all-repository check listed for one document, with the
 * commit prefix it was checked at; null when that check did not list it. */
export function checkedChange(repository, path) {
  const repo = lastAllCheck?.result?.repositories?.find(r => r.repository === repository && r.changed)
  const change = repo?.changes?.find(c => c.path === path)
  return change ? { kind: change.kind, to: repo.to ?? null } : null
}
export function resetSiteState() { lastPullCheck = null; lastSiteCheck = null; lastAllCheck = null }

const git = (args, cwd, timeout = 30000) => new Promise((resolve, reject) =>
  execFile('git', args, {
    cwd, timeout, maxBuffer: 1 << 24, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }, (error, out) => error ? reject(error) : resolve(out.trim())))

/** Unique connected source repositories, read from the checkout's own connection map. */
export async function listSources(checkout = checkoutPath()) {
  let map
  try { map = JSON.parse(await readFile(join(checkout, CONNECTIONS), 'utf8')) }
  catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  const names = Object.values(map)
    .filter(entry => entry?.status === 'connected' && typeof entry.repository === 'string' && entry.repository !== LOCAL)
    .map(entry => entry.repository)
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

async function resolveTarget(target, checkout) {
  if (target === 'all') return '--all'
  const sources = await listSources(checkout)
  if (typeof target !== 'string' || !sources.includes(target)) throw new Error('SOURCE_DENIED')
  return target
}

/** Runs one fixed script. Keeps all stdout (rolling tail beyond 8 MB); stderr is
 * only used to classify a failure and is never returned. */
function runScript(command, args, { cwd, timeout, env }) {
  return new Promise(resolve => {
    let child
    try {
      child = spawn(command, args, {
        cwd, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env },
      })
    } catch { return resolve({ code: null, startFailed: true, out: '', err: '' }) }
    let out = '', err = '', done = false
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value) }
    const kill = signal => { try { process.kill(-child.pid, signal) } catch { /* already gone */ } }
    const timer = setTimeout(() => {
      kill('SIGTERM')
      setTimeout(() => kill('SIGKILL'), 10000).unref()
      finish({ code: null, timedOut: true, out, err })
    }, timeout)
    child.stdout.on('data', chunk => {
      out += chunk.toString('utf8')
      if (out.length > 8 << 20) out = out.slice(-65536)
    })
    child.stderr.on('data', chunk => { if (err.length < 8192) err += chunk.toString('utf8') })
    child.on('error', () => finish({ code: null, startFailed: true, out, err }))
    child.on('close', code => finish({ code, out, err }))
  })
}

export function parsePullOutput(text) {
  const repositories = []
  let summary = null
  for (const line of String(text).split('\n')) {
    let m = /^CHANGED\s+(\S+)\s+(\S+) -> (\S+)\s*$/.exec(line)
    if (m) { repositories.push({ repository: m[1], changed: true, from: m[2], to: m[3], changes: [] }); continue }
    m = /^same\s+(\S+)(?:\s+\(head moved .*\))?\s*$/.exec(line)
    if (m) { repositories.push({ repository: m[1], changed: false, headMoved: line.includes('(head moved'), changes: [] }); continue }
    m = /^\s{4,}(NEW|CHANGED|REMOVED)\s+(.+)$/.exec(line)
    if (m && repositories.length) { repositories.at(-1).changes.push({ kind: m[1], path: m[2] }); continue }
    if (/^(No document changes\.|\d+ repository\(ies\) have document changes|Snapshot updated for \d+)/.test(line)) summary = line
  }
  const changed = repositories.filter(r => r.changed)
  const removed = changed.reduce((n, r) => n + r.changes.filter(c => c.kind === 'REMOVED').length, 0)
  return { repositories, changedCount: changed.length, removedCount: removed, summary }
}

function pullFailure(err) {
  if (/No GitHub login/.test(err)) return 'GITHUB_LOGIN_MISSING'
  if (/uncommitted changes/.test(err)) return 'SNAPSHOT_DIRTY'
  if (/Not a connected public source/.test(err)) return 'SOURCE_DENIED'
  return 'PULL_FAILED'
}

/** Check (write=false) or update the working-tree snapshot (write=true). A write
 * needs a check of the same target first, and explicit acceptance of removals. */
export async function runPull(target, write = false, acceptRemovals = false, checkout = checkoutPath()) {
  const arg = await resolveTarget(target, checkout)
  const script = join(checkout, 'scripts/pull-repository.mjs')
  try { await stat(script) } catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  if (write) {
    if (!lastPullCheck || lastPullCheck.target !== target || Date.now() - lastPullCheck.at > CHECK_VALID_MS)
      throw new Error('CHECK_REQUIRED')
    if (lastPullCheck.removedCount > 0 && acceptRemovals !== true) throw new Error('REMOVALS_NOT_ACCEPTED')
  }
  return withPublishLock('pull', () => pullUnlocked(target, arg, write, checkout))
}

async function pullUnlocked(target, arg, write, checkout) {
  const script = join(checkout, 'scripts/pull-repository.mjs')
  const run = await runScript(process.execPath,
    ['--experimental-strip-types', script, arg, ...(write ? ['--write'] : [])],
    { cwd: checkout, timeout: 5 * 60000, env: { NODE_OPTIONS: '--no-network-family-autoselection' } })
  const parsed = parsePullOutput(run.out)
  if (run.code !== 0) {
    const error = run.timedOut ? 'PULL_TIMEOUT' : run.startFailed ? 'PULL_START_FAILED' : pullFailure(run.err)
    return { ok: false, write, error, ...parsed }
  }
  if (write) { lastPullCheck = null; lastAllCheck = null }
  else {
    lastPullCheck = { target, changedCount: parsed.changedCount, removedCount: parsed.removedCount, at: Date.now() }
    if (target === 'all') lastAllCheck = { at: Date.now(), result: { ok: true, write, ...parsed } }
  }
  return { ok: true, write, written: write && parsed.changedCount > 0, ...parsed }
}

/** Where the checkout stands between the pull and the site publish. */
export async function checkoutState(checkout = checkoutPath(), fetch = true) {
  let fetched = false
  if (fetch) { try { await git(['fetch', '-q', 'origin', 'main'], checkout, 60000); fetched = true } catch { /* offline */ } }
  let branch, dirty, ahead, behind, head, origin
  try {
    branch = await git(['symbolic-ref', '--short', '-q', 'HEAD'], checkout).catch(() => '')
    dirty = (await git(['status', '--porcelain', '--', SNAPSHOT], checkout)) !== ''
    ahead = Number(await git(['rev-list', '--count', 'origin/main..HEAD'], checkout))
    behind = Number(await git(['rev-list', '--count', 'HEAD..origin/main'], checkout))
    head = await git(['rev-parse', '--short', 'HEAD'], checkout)
    origin = await git(['rev-parse', '--short', 'origin/main'], checkout)
  } catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  let otherDirty = 0
  try {
    otherDirty = (await git(['status', '--porcelain', '--untracked-files=no'], checkout))
      .split('\n').filter(line => line && !line.endsWith(' ' + SNAPSHOT)).length
  } catch { /* counted as clean */ }
  let aheadOnlySnapshot = true
  if (ahead > 0) {
    const files = (await git(['diff', '--name-only', 'origin/main...HEAD'], checkout)).split('\n').filter(Boolean)
    aheadOnlySnapshot = files.length > 0 && files.every(file => file === SNAPSHOT)
  }
  return { fetched, branch, snapshotDirty: dirty, otherDirty, ahead, behind, aheadOnlySnapshot, head, originMain: origin }
}

async function countChangedRepositories(checkout) {
  try {
    const before = JSON.parse(await git(['show', 'HEAD:' + SNAPSHOT], checkout))
    const after = JSON.parse(await readFile(join(checkout, SNAPSHOT), 'utf8'))
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...keys].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).length
  } catch { return 0 }
}

/** Commits only the snapshot file and pushes it. Refuses to carry any other
 * local commit or change to origin/main. */
export async function commitAndPushSnapshot(checkout = checkoutPath()) {
  return withPublishLock('snapshot', async () => {
    const state = await checkoutState(checkout)
    assertPushable(state)
    if (!state.snapshotDirty && state.ahead === 0) throw new Error('NOTHING_TO_COMMIT')
    return commitPushUnlocked(state, checkout)
  })
}

function assertPushable(state) {
  if (!state.fetched) throw new Error('FETCH_FAILED')
  if (state.branch !== 'main') throw new Error('NOT_ON_MAIN')
  if (state.behind > 0) throw new Error('BEHIND_ORIGIN')
  if (state.ahead > 0 && !state.aheadOnlySnapshot) throw new Error('UNPUSHED_OTHER_COMMITS')
}

async function commitPushUnlocked(state, checkout) {
  let repositories = null
  if (state.snapshotDirty) {
    repositories = await countChangedRepositories(checkout)
    const message = repositories > 0
      ? `content: pull document changes from ${repositories} source ${repositories === 1 ? 'repository' : 'repositories'}`
      : 'content: update repository document snapshot'
    try { await git(['commit', '-q', '-m', message, '--only', '--', SNAPSHOT], checkout) }
    catch { throw new Error('COMMIT_FAILED') }
  }
  const commit = await git(['rev-parse', '--short', 'HEAD'], checkout)
  try { await git(['push', '-q', 'origin', 'HEAD:main'], checkout, 120000) }
  catch { return { ok: false, error: 'PUSH_FAILED', commit, repositories } }
  return { ok: true, commit, repositories }
}

export function parseSiteOutput(text, limit = 400) {
  const changes = []
  const counts = { CHANGED: 0, ADDED: 0, REMOVED: 0 }
  const result = {
    commit: null, liveRelease: null, buildFiles: null, nothing: false, differCount: null,
    creating: null, newRelease: null, published: false, rollback: null,
  }
  for (const line of String(text).split('\n')) {
    let m = /^Building origin\/main (\S+); live release: (?:releases\/)?(\S+)$/.exec(line)
    if (m) { result.commit = m[1]; result.liveRelease = m[2]; continue }
    m = /^Build finished: (\d+) files$/.exec(line)
    if (m) { result.buildFiles = Number(m[1]); continue }
    m = /^(CHANGED|ADDED|REMOVED)\s+(.+)$/.exec(line)
    if (m) { counts[m[1]]++; if (changes.length < limit) changes.push({ kind: m[1], path: m[2] }); continue }
    if (line.startsWith('Nothing to publish')) { result.nothing = true; continue }
    m = /^Dry run: (\d+) path\(s\) differ/.exec(line)
    if (m) { result.differCount = Number(m[1]); continue }
    m = /^Creating release (\S+)$/.exec(line)
    if (m) { result.creating = m[1]; continue }
    m = /^Published and verified: (\S+)$/.exec(line)
    if (m) { result.published = true; result.newRelease = m[1]; continue }
    if (line.startsWith('Rollback: ')) result.rollback = line.slice('Rollback: '.length)
  }
  const total = counts.CHANGED + counts.ADDED + counts.REMOVED
  return { ...result, changes, counts, total, truncated: total > changes.length }
}

/** Dry run (apply=false) or publish. A publish needs a dry run of the same
 * origin/main commit first, so nothing unseen goes live. */
export async function runSitePublish(apply = false, checkout = checkoutPath()) {
  const script = join(checkout, 'scripts/publish-site.sh')
  try { await stat(script) } catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  return withPublishLock('site', async () => {
    if (apply) {
      if (!lastSiteCheck || Date.now() - lastSiteCheck.at > CHECK_VALID_MS) throw new Error('CHECK_REQUIRED')
      try { await git(['fetch', '-q', 'origin', 'main'], checkout, 60000) } catch { throw new Error('FETCH_FAILED') }
      const origin = await git(['rev-parse', '--short', 'origin/main'], checkout)
      if (origin !== lastSiteCheck.commit) throw new Error('ORIGIN_MOVED')
    }
    return siteUnlocked(apply, checkout)
  })
}

async function siteUnlocked(apply, checkout) {
  const run = await runScript(join(checkout, 'scripts/publish-site.sh'), apply ? ['--apply'] : [],
    { cwd: checkout, timeout: 20 * 60000 })
  const parsed = parseSiteOutput(run.out)
  if (run.code === 0) {
    lastSiteCheck = apply || !parsed.commit ? null : { commit: parsed.commit, at: Date.now() }
    return { ok: true, apply, ...parsed }
  }
  lastSiteCheck = null
  let error = 'PUBLISH_FAILED'
  if (run.timedOut) error = 'PUBLISH_TIMEOUT'
  else if (run.startFailed) error = 'PUBLISH_START_FAILED'
  else if (run.code === 3) error = 'SSH_KEY_NOT_LOADED'
  else if (run.code === 4) error = 'BUILD_FAILED'
  else if (run.code === 5) error = 'VERIFY_FAILED'
  else if (parsed.creating) error = 'PUBLISH_UNVERIFIED'
  return { ok: false, apply, error, ...parsed }
}

// ---- One-page status and one-click publish (creative decision, 2026-11-10) ----

const RELEASE_URL = 'https://www.babuni.dev/release.txt'
const GITHUB_OWNER = 'babunidev'

const execText = (command, args, timeout = 20000) => new Promise((resolve, reject) =>
  execFile(command, args, { timeout, maxBuffer: 1 << 22 }, (error, out) => error ? reject(error) : resolve(out.trim())))

/** The release name the live site reports, e.g. 20261110-004601-fd89891-site. */
export function parseReleaseName(name) {
  const m = /^(\d{8}-\d{6})-([0-9a-f]{7,40})-(site|doc)$/.exec(String(name).trim())
  return m ? { name: m[0], commit: m[2], kind: m[3] } : null
}

let readRelease = () => execText('curl', ['-fsS', '--max-time', '15', RELEASE_URL + '?check=' + Date.now()])
let listGithubRepositories = async () => JSON.parse(await execText('gh',
  ['repo', 'list', GITHUB_OWNER, '--limit', '300', '--json', 'nameWithOwner,isPrivate,isArchived'], 30000))
/** Test hook: replace the two network reads with fixtures. */
export function setStatusReaders(readers) {
  if (readers.release) readRelease = readers.release
  if (readers.repositories) listGithubRepositories = readers.repositories
}

/** Fast part: what is live and what the website repository has that is not. */
export async function siteStatus(checkout = checkoutPath()) {
  const state = await checkoutState(checkout)
  let live = null
  try { live = parseReleaseName(await readRelease()) } catch { /* reported as unknown */ }
  let pendingCommits = null
  if (live) {
    try {
      const log = await git(['log', '--format=%h%x09%s', `${live.commit}..origin/main`], checkout)
      pendingCommits = log ? log.split('\n').map(line => {
        const [commit, ...subject] = line.split('\t')
        return { commit, subject: subject.join('\t') }
      }) : []
    } catch { /* live commit unknown to this checkout */ }
  }
  const snapshotWaiting = state.snapshotDirty || (state.ahead > 0 && state.aheadOnlySnapshot)
  const upToDate = live?.kind === 'site' && pendingCommits?.length === 0 && !snapshotWaiting
  return { state, live, pendingCommits, snapshotWaiting, upToDate }
}

/** Slow part: document changes in the connected repositories (cached for ten
 * minutes), plus GitHub repositories that are not connected to the website. */
export async function repositoryChanges(refresh = false, checkout = checkoutPath()) {
  if (!refresh && lastAllCheck && Date.now() - lastAllCheck.at < ALL_CHECK_CACHE_MS) {
    return { ...lastAllCheck.result, checkedAt: new Date(lastAllCheck.at).toISOString(), cached: true,
      notOnWebsite: await notOnWebsite(checkout) }
  }
  const result = await runPull('all', false, false, checkout)
  return { ...result, checkedAt: new Date().toISOString(), cached: false, notOnWebsite: await notOnWebsite(checkout) }
}

async function notOnWebsite(checkout) {
  try {
    const map = JSON.parse(await readFile(join(checkout, CONNECTIONS), 'utf8'))
    const connected = new Set(Object.values(map).filter(entry => entry?.status === 'connected')
      .map(entry => String(entry.repository).toLowerCase()))
    return (await listGithubRepositories())
      .filter(repo => !repo.isArchived && !connected.has(repo.nameWithOwner.toLowerCase()))
      .map(repo => ({ repository: repo.nameWithOwner, private: repo.isPrivate }))
      .sort((a, b) => a.repository.localeCompare(b.repository))
  } catch { return null }
}

/** One click: pull every connected repository's document changes, commit and
 * push the snapshot, then build and publish origin/main. Needs the page's
 * all-repository check from the last hour; removals it listed must be accepted,
 * and a write that removes more than that check showed is undone. It only
 * commits a snapshot it wrote itself: an already modified snapshot belongs to
 * other work in the checkout and stops the publish. */
export async function publishAll(acceptRemovals = false, checkout = checkoutPath()) {
  const script = join(checkout, 'scripts/publish-site.sh')
  try { await stat(script) } catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  const checked = lastPullCheck
  if (!checked || checked.target !== 'all' || Date.now() - checked.at > CHECK_VALID_MS) throw new Error('CHECK_REQUIRED')
  if (checked.removedCount > 0 && acceptRemovals !== true) throw new Error('REMOVALS_NOT_ACCEPTED')
  return withPublishLock('publish-all', async () => {
    let state = await checkoutState(checkout)
    if (state.snapshotDirty) throw new Error('SNAPSHOT_DIRTY')
    assertPushable(state)
    const steps = { pull: null, push: null, site: null }
    if (checked.changedCount > 0) {
      steps.pull = await pullUnlocked('all', '--all', true, checkout)
      if (!steps.pull.ok) return { ok: false, step: 'pull', error: steps.pull.error, steps }
      if (steps.pull.removedCount > checked.removedCount) {
        await git(['checkout', '--', SNAPSHOT], checkout)
        return { ok: false, step: 'pull', error: 'CHANGED_SINCE_CHECK', steps }
      }
      state = await checkoutState(checkout, false)
    }
    if (state.snapshotDirty || state.ahead > 0) {
      steps.push = await commitPushUnlocked(state, checkout)
      if (!steps.push.ok) return { ok: false, step: 'push', error: steps.push.error, steps }
    }
    steps.site = await siteUnlocked(true, checkout)
    if (!steps.site.ok) return { ok: false, step: 'site', error: steps.site.error, steps }
    lastAllCheck = null
    return { ok: true, steps }
  })
}
