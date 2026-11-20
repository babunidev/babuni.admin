import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkoutPath } from './portfolioDocuments.mjs'

// Read-only overview of every project on the website. The project list comes
// from the babuni.dev checkout (its connection map and tile names); commits and
// documents are read live from GitHub with the existing `gh` login. Nothing is
// written anywhere, and the browser can only name a project id from that list
// and a Markdown path that the project's own tree listing returned.
const CONNECTIONS = 'src/content/project-repositories.json'
const TILES = 'src/lib/demo-projects.ts'
const LIST_CACHE_MS = 10 * 60 * 1000
const TREE_CACHE_MS = 10 * 60 * 1000
const MAX_DOCUMENTS = 300
const MAX_BYTES = 1024 * 1024
const NAME = /^[A-Za-z0-9_.-]{1,100}$/
const BRANCH = /^[A-Za-z0-9_./-]{1,100}$/
const MARKDOWN = /\.(md|markdown)$/i

const run = (args, { timeout = 30000, allowFailure = false } = {}) => new Promise((resolve, reject) =>
  execFile('gh', args, {
    timeout, maxBuffer: 1 << 25, env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
  }, (error, stdout) => {
    if (error && !(allowFailure && stdout)) return reject(error)
    resolve(stdout)
  }))

export const github = {
  graphql: async query => JSON.parse(await run(['api', 'graphql', '-f', `query=${query}`],
    { timeout: 60000, allowFailure: true })),
  tree: async (repository, branch) => JSON.parse(await run(['api',
    `repos/${repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`])),
  file: async (repository, path, branch) => run(['api', '-H', 'Accept: application/vnd.github.raw',
    `repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`]),
}

/** Project names and tints from the website's tile list; ids alone if it cannot be read. */
export function parseTiles(source) {
  const tiles = new Map()
  const block = /\{[^{}]*?"id":\s*"([^"]+)"[^{}]*?\}/g
  for (const match of String(source).matchAll(block)) {
    const text = match[0]
    const name = /"name":\s*"((?:[^"\\]|\\.)*)"/.exec(text)?.[1]
    const summary = /"shortSummary":\s*"((?:[^"\\]|\\.)*)"/.exec(text)?.[1]
    const tint = /"tint":\s*"(#[0-9a-fA-F]{3,8})"/.exec(text)?.[1]
    const unescape = value => value === undefined ? null : JSON.parse(`"${value}"`)
    tiles.set(match[1], { name: unescape(name), summary: unescape(summary), tint: tint ?? null })
  }
  return tiles
}

/** The website's projects in its own order, each with its repository when connected. */
export async function websiteProjects(checkout = checkoutPath()) {
  let map
  try { map = JSON.parse(await readFile(join(checkout, CONNECTIONS), 'utf8')) }
  catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  let tiles = new Map()
  try { tiles = parseTiles(await readFile(join(checkout, TILES), 'utf8')) } catch { /* names fall back to ids */ }
  const ids = [...new Set([...tiles.keys(), ...Object.keys(map)])]
  return ids.map(id => {
    const entry = map[id] ?? {}
    const tile = tiles.get(id) ?? {}
    const [owner, name] = typeof entry.repository === 'string' ? entry.repository.split('/') : []
    const connected = entry.status === 'connected' && NAME.test(owner ?? '') && NAME.test(name ?? '')
      && BRANCH.test(entry.branch ?? 'main')
    return {
      id, name: tile.name ?? id, summary: tile.summary ?? null, tint: tile.tint ?? null,
      status: connected ? 'connected' : (typeof entry.status === 'string' ? entry.status : 'no-repository'),
      repository: connected ? entry.repository : null,
      branch: connected ? (entry.branch ?? 'main') : null,
    }
  })
}

/** The newest `##` or `###` section of a changelog with a date anywhere in its heading
 * (`## 2026-11-19 — …`, `## 0.4.11-beta — 2026-11-13`, `## 0.6.1-beta — title (2026-11-19)`,
 * or `### Changed — title (2026-11-19)` under `## [Unreleased]`), or null. */
export function latestChangelogEntry(text) {
  if (typeof text !== 'string') return null
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let best = null
  for (let i = 0; i < lines.length; i++) {
    const level = /^(#{2,3})\s/.exec(lines[i])?.[1].length
    if (!level) continue
    const date = /(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)/.exec(lines[i])?.[1]
    if (!date || (best && best.date >= date)) continue
    const title = lines[i].replace(/^#{2,3}\s+/, '').replace(date, '')
      .replace(/[[\]()]/g, ' ').replace(/\s*[—–-]\s*$|^\s*[—–-]\s*/g, '').replace(/\s+[—–-]\s+[—–-]\s+/, ' — ')
      .replace(/\s{2,}/g, ' ').trim()
    let end = i + 1
    while (end < lines.length && !(/^(#+)\s/.exec(lines[end])?.[1].length <= level)) end++
    best = { date, title: title || null, body: lines.slice(i + 1, end).join('\n').trim().slice(0, 4000) }
  }
  return best
}

const quote = value => JSON.stringify(value)

export function projectsQuery(projects) {
  const parts = projects.map((p, i) => {
    const [owner, name] = p.repository.split('/')
    return `p${i}: repository(owner:${quote(owner)},name:${quote(name)}){ url isPrivate pushedAt
      ref(qualifiedName:${quote('refs/heads/' + p.branch)}){ target{ ... on Commit{
        history(first:5){ nodes{ abbreviatedOid messageHeadline committedDate url } } } } }
      changelog: object(expression:${quote(p.branch + ':CHANGELOG.md')}){ ... on Blob{ text } } }`
  })
  return `query{ ${parts.join('\n')} }`
}

const days = (iso, now) => iso ? Math.floor((now - Date.parse(iso)) / 86400000) : null

let listCache = null
let listInFlight = null
const treeCache = new Map()
export function resetProjectOverview() { listCache = null; listInFlight = null; treeCache.clear() }

export async function projectOverview(refresh = false, deps = {}) {
  if (!refresh && listCache && Date.now() - listCache.at < LIST_CACHE_MS) return { ...listCache.result, cached: true }
  if (listInFlight) return listInFlight
  listInFlight = buildOverview(deps)
    .then(result => { listCache = { at: Date.now(), result }; return result })
    .finally(() => { listInFlight = null })
  return listInFlight
}

async function buildOverview(deps) {
  const gh = deps.github || github
  const now = deps.now ?? Date.now()
  const projects = await websiteProjects(deps.checkout)
  const connected = projects.filter(p => p.repository)
  let response
  try { response = await gh.graphql(projectsQuery(connected)) } catch { throw new Error('GITHUB_READ_FAILED') }
  if (!response?.data) throw new Error('GITHUB_READ_FAILED')
  connected.forEach((p, i) => {
    const repo = response.data[`p${i}`]
    if (!repo) { p.readError = 'REPOSITORY_NOT_FOUND'; return }
    const nodes = repo.ref?.target?.history?.nodes
    if (!Array.isArray(nodes)) { p.readError = 'BRANCH_NOT_FOUND'; return }
    p.url = repo.url
    p.private = repo.isPrivate === true
    p.commits = nodes.map(n => ({
      commit: n.abbreviatedOid, subject: n.messageHeadline, date: n.committedDate, url: n.url,
    }))
    p.lastCommitAt = p.commits[0]?.date ?? null
    p.changelog = latestChangelogEntry(repo.changelog?.text)
    // Babuni's own record of work, not a commit, decides how long a project has waited:
    // bulk documentation commits touch many repositories on the same day.
    p.lastWorkedOn = p.changelog?.date ?? p.lastCommitAt?.slice(0, 10) ?? null
    p.lastWorkedFrom = p.changelog ? 'changelog' : p.lastCommitAt ? 'commit' : null
    p.daysSince = p.lastWorkedOn ? days(p.lastWorkedOn + 'T00:00:00Z', now) : null
  })
  const dated = connected.filter(p => p.lastWorkedOn)
  const oldest = dated.reduce((a, b) => (!a || b.lastWorkedOn < a.lastWorkedOn ? b : a), null)
  return {
    ok: true, checkedAt: new Date(now).toISOString(), cached: false,
    revision: oldest?.id ?? null,
    projects: projects.map(p => ({ ...p, needsRevision: p.id === oldest?.id })),
  }
}

async function connectedProject(id, deps) {
  const projects = await websiteProjects(deps.checkout)
  const project = projects.find(p => p.id === id)
  if (!project) throw new Error('PROJECT_UNKNOWN')
  if (!project.repository) throw new Error('PROJECT_NOT_CONNECTED')
  return project
}

async function markdownTree(project, deps) {
  const key = `${project.repository}@${project.branch}`
  const hit = treeCache.get(key)
  if (hit && Date.now() - hit.at < TREE_CACHE_MS) return hit.documents
  let tree
  try { tree = await (deps.github || github).tree(project.repository, project.branch) }
  catch { throw new Error('GITHUB_READ_FAILED') }
  const documents = (Array.isArray(tree?.tree) ? tree.tree : [])
    .filter(e => e?.type === 'blob' && typeof e.path === 'string' && MARKDOWN.test(e.path)
      && !e.path.split('/').some(part => part.startsWith('.') || part === 'node_modules'))
    .map(e => ({ path: e.path, size: Number(e.size) || 0 }))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
    .slice(0, MAX_DOCUMENTS)
  treeCache.set(key, { at: Date.now(), documents })
  return documents
}

/** Every Markdown file in one project's repository, without bodies. */
export async function projectDocuments(id, deps = {}) {
  const project = await connectedProject(String(id ?? ''), deps)
  const documents = await markdownTree(project, deps)
  return { ok: true, id: project.id, repository: project.repository, branch: project.branch, documents }
}

/** One Markdown file, only if that project's tree listing contains it. */
export async function projectDocument(id, path, deps = {}) {
  const project = await connectedProject(String(id ?? ''), deps)
  const documents = await markdownTree(project, deps)
  const entry = documents.find(d => d.path === path)
  if (!entry) throw new Error('DOCUMENT_NOT_LISTED')
  if (entry.size > MAX_BYTES) throw new Error('DOCUMENT_TOO_LARGE')
  let body
  try { body = await (deps.github || github).file(project.repository, entry.path, project.branch) }
  catch { throw new Error('GITHUB_READ_FAILED') }
  if (typeof body !== 'string' || Buffer.byteLength(body) > MAX_BYTES) throw new Error('DOCUMENT_TOO_LARGE')
  return { ok: true, id: project.id, repository: project.repository, path: entry.path, body: body.replace(/^﻿/, '') }
}
