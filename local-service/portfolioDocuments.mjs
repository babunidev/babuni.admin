import { spawn, execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { withPublishLock } from './publishLock.mjs'

// Fixed, server-owned scope: the babuni.dev checkout and its standard documents.
export const DEFAULT_CHECKOUT = join(homedir(), 'Projects/babunidev/babuni.dev')
export const checkoutPath = () => process.env.BABUNI_DEV_CHECKOUT || DEFAULT_CHECKOUT
const ALLOWED = /^(?:(?:README|CONCEPT|CHANGELOG|ROADMAP)\.md|docs\/[A-Z][A-Z_]*\.md)$/

export function isAllowedDocumentPath(path) {
  return typeof path === 'string' && path.length <= 60 && ALLOWED.test(path)
}

export function parsePublishOutput(text) {
  const files = []
  let liveRelease = null, newRelease = null, published = false, nothing = false
  for (const line of String(text).split('\n')) {
    let m = /^(CHANGED|unchanged)\s+(\S+)$/.exec(line)
    if (m) { files.push({ file: m[2], changed: m[1] === 'CHANGED' }); continue }
    m = /^Live release: releases\/(\S+)$/.exec(line)
    if (m) { liveRelease = m[1]; continue }
    m = /^Published and verified: (\S+)$/.exec(line)
    if (m) { published = true; newRelease = m[1]; continue }
    if (line.startsWith('Nothing to publish')) nothing = true
  }
  return { files, liveRelease, newRelease, published, nothing }
}

const git = (args, cwd) => new Promise((resolve, reject) =>
  execFile('git', args, { cwd, timeout: 30000, maxBuffer: 1 << 20 }, (error, out) =>
    error ? reject(error) : resolve(out)))

export async function listDocuments(checkout = checkoutPath()) {
  try { await git(['fetch', '-q', 'origin', 'main'], checkout) } catch { /* offline: use last fetch */ }
  let out
  try { out = await git(['ls-tree', '-r', '--name-only', 'origin/main'], checkout) }
  catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  return out.split('\n').filter(isAllowedDocumentPath).sort()
}

/** Dry run by default; apply=true publishes. Stderr is drained and never exposed. */
export async function runPublish(path, apply = false, checkout = checkoutPath()) {
  if (!isAllowedDocumentPath(path)) throw new Error('DOCUMENT_PATH_DENIED')
  const script = join(checkout, 'scripts/publish-document.sh')
  try { await stat(script) } catch { throw new Error('CHECKOUT_UNAVAILABLE') }
  return withPublishLock('document', () => new Promise(resolve => {
    const child = spawn(script, apply ? [path, '--apply'] : [path], {
      cwd: checkout, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = '', size = 0, done = false
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value) }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ ok: false, code: 'PUBLISH_TIMEOUT', error: 'PUBLISH_TIMEOUT' })
    }, apply ? 180000 : 90000)
    child.stdout.on('data', chunk => {
      if (size + chunk.length > 65536) return
      size += chunk.length
      out += chunk.toString('utf8')
    })
    child.stderr.on('data', () => {})
    child.on('error', () => finish({ ok: false, code: 'PUBLISH_START_FAILED', error: 'PUBLISH_START_FAILED' }))
    child.on('close', code => {
      const parsed = parsePublishOutput(out)
      if (code === 0) return finish({ ok: true, apply, ...parsed })
      const failure = code === 3 ? 'SSH_KEY_NOT_LOADED' : 'PUBLISH_FAILED'
      finish({ ok: false, code: failure, error: failure, ...parsed })
    })
  }))
}
