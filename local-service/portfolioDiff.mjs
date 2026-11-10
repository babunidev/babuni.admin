import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkoutPath } from './portfolioDocuments.mjs'
import { SNAPSHOT, checkedChange } from './portfolioSite.mjs'

// What changed inside one document: the version in the babuni.dev snapshot
// (what the website shows) against the current version in its own repository.
// Only documents the last all-repository check listed can be compared, so the
// browser cannot make this fetch arbitrary repositories or files.
const MAX_LINES = 3000
const MAX_BYTES = 2 * 1024 * 1024
const TEXT = /\.(md|markdown|txt)$/i
const CONNECTIONS = 'src/content/project-repositories.json'

const run = (command, args, options = {}) => new Promise((resolve, reject) =>
  execFile(command, args, { timeout: 20000, maxBuffer: MAX_BYTES + 65536, ...options },
    (error, stdout) => error && !(options.allowExit1 && error.code === 1) ? reject(error) : resolve(stdout)))

const ghRead = {
  head: async (repository, branch) =>
    (await run('gh', ['api', `repos/${repository}/commits/${encodeURIComponent(branch)}`, '--jq', '.sha'])).trim(),
  file: async (repository, path, sha) => run('gh', ['api', '-H', 'Accept: application/vnd.github.raw',
    `repos/${repository}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`]),
}

/** Line diff with three lines of context, from `git diff --no-index`. */
export async function lineDiff(before, after) {
  const dir = await mkdtemp(join(tmpdir(), 'babuni-diff-'))
  try {
    await writeFile(join(dir, 'a'), before)
    await writeFile(join(dir, 'b'), after)
    const out = await run('git', ['diff', '--no-index', '--no-color', '--no-ext-diff', '-U3', '--', 'a', 'b'],
      { cwd: dir, allowExit1: true })
    const lines = []
    let added = 0, removed = 0, started = false
    for (const line of out.split('\n')) {
      if (line.startsWith('@@')) { started = true; lines.push({ t: '@', s: line }); continue }
      if (!started || line === '\\ No newline at end of file') continue
      const t = line[0]
      if (t !== '+' && t !== '-' && t !== ' ') continue
      if (t === '+') added++
      if (t === '-') removed++
      lines.push({ t, s: line.slice(1) })
    }
    return { added, removed, truncated: lines.length > MAX_LINES, lines: lines.slice(0, MAX_LINES) }
  } finally { await rm(dir, { recursive: true, force: true }) }
}

export async function documentDiff(repository, path, deps = {}) {
  const checkout = deps.checkout || checkoutPath()
  const change = (deps.checked || checkedChange)(repository, path)
  if (!change) throw new Error('CHANGE_NOT_LISTED')
  let snapshots, connections
  try {
    snapshots = JSON.parse(await readFile(join(checkout, SNAPSHOT), 'utf8'))
    connections = JSON.parse(await readFile(join(checkout, CONNECTIONS), 'utf8'))
  } catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  const snapshot = snapshots[repository]
  const branch = snapshot?.branch ??
    Object.values(connections).find(c => c?.repository === repository && c.status === 'connected')?.branch
  if (typeof branch !== 'string' || !branch) throw new Error('CHECKOUT_UNAVAILABLE')
  const isImage = !TEXT.test(path) || (snapshot?.images ?? []).some(i => i.path === path)
  const base = { ok: true, repository, path, kind: change.kind, branch }
  if (isImage) return { ...base, binary: true }

  const read = deps.read || ghRead
  let sha
  try { sha = await read.head(repository, branch) } catch { throw new Error('GITHUB_READ_FAILED') }
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('GITHUB_READ_FAILED')
  const before = snapshot?.documents?.find(d => d.path === path)?.body ?? ''
  let after = ''
  if (change.kind !== 'REMOVED') {
    try { after = await read.file(repository, path, sha) } catch { throw new Error('GITHUB_READ_FAILED') }
    if (typeof after !== 'string' || Buffer.byteLength(after) > MAX_BYTES) throw new Error('DOCUMENT_TOO_LARGE')
    after = after.replace(/^\uFEFF/, '') // the snapshot's TextDecoder drops a byte-order mark too
  }
  return {
    ...base, binary: false, commit: sha.slice(0, 8),
    movedSinceCheck: Boolean(change.to) && !sha.startsWith(change.to),
    ...await lineDiff(before, after),
  }
}
