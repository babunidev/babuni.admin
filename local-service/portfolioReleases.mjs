import { spawn } from 'node:child_process'
import { buildContentSshArgs } from './morkahjaContentRunner.mjs'
import { portfolioDeployTarget, portfolioSshEnvironment } from './babuniDevConnections.mjs'
import { withPublishLock } from './publishLock.mjs'

// Removing old website releases on the VPS. Every publish leaves a hard-linked
// copy of the site in /var/www/babuni.dev/releases; this keeps the live release,
// the one before it (the rollback target), anything newer than the live one,
// and the newest KEEP_RECENT overall. Nothing about the plan comes from the browser.
export const RELEASE_ROOT = '/var/www/babuni.dev'
export const KEEP_RECENT = 5
export const RELEASE_NAME = /^\d{8}-\d{6}-[0-9a-f]{7,40}-(site|doc)$/
const PLAN_MAX_AGE_MS = 10 * 60 * 1000

const py = value => value === null ? 'None' : JSON.stringify(value)

/** The fixed Python program sent to the server's python3 over stdin. `remove`
 * and `expectCurrent` are only set for a cleanup and are re-checked there. */
export function buildReleaseScript({ root = RELEASE_ROOT, keep = KEEP_RECENT, remove = null, expectCurrent = null } = {}) {
  if (remove !== null && (!Array.isArray(remove) || !remove.every(n => RELEASE_NAME.test(n)))) {
    throw new Error('RELEASE_NAME_INVALID')
  }
  if (expectCurrent !== null && !RELEASE_NAME.test(expectCurrent)) throw new Error('RELEASE_NAME_INVALID')
  return [
    'import json, os, re, shutil, stat',
    `ROOT = ${JSON.stringify(root)}`,
    `KEEP = ${Number(keep)}`,
    `REMOVE = ${py(remove)}`,
    `EXPECT = ${py(expectCurrent)}`,
    'PAT = re.compile(r"^\\d{8}-\\d{6}-[0-9a-f]{7,40}-(site|doc)$")',
    'REL = os.path.join(ROOT, "releases")',
    'def out(**kw):',
    '    print(json.dumps(kw)); raise SystemExit(0)',
    'live_path = os.path.realpath(os.path.join(ROOT, "current"))',
    'current = os.path.basename(live_path)',
    'if os.path.dirname(live_path) != os.path.realpath(REL) or not PAT.match(current):',
    '    out(ok=False, code="LIVE_RELEASE_UNKNOWN")',
    'names, other = [], []',
    'for n in os.listdir(REL):',
    '    p = os.path.join(REL, n)',
    '    if PAT.match(n) and not os.path.islink(p) and os.path.isdir(p): names.append(n)',
    '    else: other.append(n)',
    'names.sort(); other.sort()',
    'if current not in names: out(ok=False, code="LIVE_RELEASE_UNKNOWN")',
    'i = names.index(current)',
    'keep = set(names[-KEEP:]) | {current} | set(names[i + 1:])',
    'if i > 0: keep.add(names[i - 1])',
    'drop = [n for n in names if n not in keep]',
    'def inodes(dirs):',
    '    seen = {}',
    '    for d in dirs:',
    '        for base, subdirs, files in os.walk(os.path.join(REL, d)):',
    '            for f in files:',
    '                try: s = os.lstat(os.path.join(base, f))',
    '                except OSError: continue',
    '                seen[(s.st_dev, s.st_ino)] = s.st_blocks * 512',
    '    return seen',
    'kept = inodes(sorted(keep))',
    'freed = sum(v for k, v in inodes(drop).items() if k not in kept)',
    'previous = names[i - 1] if i > 0 else None',
    'if REMOVE is None:',
    '    out(ok=True, current=current, previous=previous, keep=sorted(keep), remove=drop, freedBytes=freed, other=other)',
    'if current != EXPECT or not set(REMOVE) <= set(drop):',
    '    out(ok=False, code="PLAN_STALE")',
    'removed, failed = [], []',
    'for n in REMOVE:',
    '    try: shutil.rmtree(os.path.join(REL, n)); removed.append(n)',
    '    except OSError: failed.append(n)',
    'out(ok=not failed, code="REMOVE_PARTIAL" if failed else None, current=current, removed=removed, failed=failed, freedBytes=freed)',
  ].join('\n') + '\n'
}

/** Runs one fixed Python program over the website deployment login. */
export function runRemotePython(config, script, { timeoutMs, limit = 65536 } = {}, deps = {}) {
  return new Promise(resolve => {
    const start = deps.spawnCommand || spawn
    const child = start('ssh', buildContentSshArgs(config), {
      shell: false, stdio: ['pipe', 'pipe', 'ignore'], env: portfolioSshEnvironment(),
    })
    let stdout = ''
    let done = false
    const finish = value => { if (!done) { done = true; clearTimeout(timer); resolve(value) } }
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish({ ok: false, code: 'RELEASES_SSH_TIMEOUT' }) }, timeoutMs)
    child.stdout?.on('data', chunk => {
      if (done) return
      if (Buffer.byteLength(stdout) + chunk.length > limit) {
        child.kill('SIGKILL'); finish({ ok: false, code: 'RELEASES_INVALID_RESPONSE' })
      } else stdout += chunk.toString('utf8')
    })
    child.on('error', () => finish({ ok: false, code: 'RELEASES_SSH_UNAVAILABLE' }))
    child.on('close', (code, signal) => {
      if (done) return
      if (code !== 0 || signal) return finish({ ok: false, code: 'RELEASES_SSH_FAILED' })
      try { finish(JSON.parse(stdout)) }
      catch { finish({ ok: false, code: 'RELEASES_INVALID_RESPONSE' }) }
    })
    child.stdin?.on('error', () => {})
    try { child.stdin?.end(script) }
    catch { child.kill('SIGKILL'); finish({ ok: false, code: 'RELEASES_SSH_FAILED' }) }
  })
}

const validPlan = p => p?.ok === true && RELEASE_NAME.test(p.current) &&
  Array.isArray(p.keep) && Array.isArray(p.remove) && p.remove.every(n => RELEASE_NAME.test(n)) &&
  !p.remove.includes(p.current) && (p.previous === null || !p.remove.includes(p.previous)) &&
  Number.isFinite(p.freedBytes) && Array.isArray(p.other) && p.other.every(n => typeof n === 'string')

let lastPlan = null
let now = () => Date.now()
/** Test hook. */
export function setReleaseClock(clock) { now = clock; lastPlan = null }

async function remote(adminProfile, script, timeoutMs, deps) {
  const target = await (deps.deployTarget || portfolioDeployTarget)(adminProfile, deps)
  if (!target.ok) return target
  return await (deps.runPython || runRemotePython)(target.config, script, { timeoutMs }, deps)
}

/** Read-only: lists what a cleanup would remove and how much space it frees. */
export async function planReleaseCleanup(adminProfile, deps = {}) {
  return await withPublishLock('release-check', async () => {
    const plan = await remote(adminProfile, buildReleaseScript(), 60000, deps)
    if (plan.ok !== true) { lastPlan = null; return { ok: false, error: plan.code || 'RELEASES_INVALID_RESPONSE' } }
    if (!validPlan(plan)) { lastPlan = null; return { ok: false, error: 'RELEASES_INVALID_RESPONSE' } }
    lastPlan = { at: now(), current: plan.current, remove: plan.remove }
    return { ok: true, current: plan.current, previous: plan.previous, keep: plan.keep,
      remove: plan.remove, freedBytes: plan.freedBytes, other: plan.other }
  })
}

/** Removes exactly the releases of the last check, if the live release is unchanged. */
export async function applyReleaseCleanup(adminProfile, deps = {}) {
  return await withPublishLock('release-cleanup', async () => {
    const plan = lastPlan
    if (!plan || now() - plan.at > PLAN_MAX_AGE_MS) throw new Error('CHECK_REQUIRED')
    if (plan.remove.length === 0) throw new Error('NOTHING_TO_REMOVE')
    lastPlan = null
    const script = buildReleaseScript({ remove: plan.remove, expectCurrent: plan.current })
    const result = await remote(adminProfile, script, 180000, deps)
    if (result.code === 'REMOVE_PARTIAL' && Array.isArray(result.removed) && Array.isArray(result.failed)) {
      return { ok: false, error: 'REMOVE_PARTIAL', current: result.current, removed: result.removed, failed: result.failed }
    }
    if (result.ok !== true) return { ok: false, error: result.code || 'RELEASES_INVALID_RESPONSE' }
    if (!Array.isArray(result.removed)) return { ok: false, error: 'RELEASES_INVALID_RESPONSE' }
    return { ok: true, current: result.current, removed: result.removed, freedBytes: result.freedBytes }
  })
}
