// Start or restart the Morkahja game's local development stack on this PC:
// the game server (`npm run dev:backend`, port 3000) and the Vite client
// (`npm run dev:client`, port 5173), both from the MorkahjaWebApp checkout.
//
// Fixed operation only: no command, path or port comes from the browser.
// Only processes listening on those two ports whose working directory lies
// inside the checkout are stopped; a port held by anything else is reported
// and left alone. The started processes are detached so they outlive a
// Babuni Admin restart, and write their output to log files.
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readlink, readFile, mkdir, open } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const run = promisify(execFile)

export const DEV_STACK_PARTS = [
  { id: 'backend', label: 'Game server', script: 'dev:backend', port: 3000 },
  { id: 'frontend', label: 'Game client', script: 'dev:client', port: 5173 },
]

export function morkahjaRepo(env = process.env) {
  return path.resolve(env.MORKAHJA_GAME_REPO?.trim() || path.join(homedir(), 'Projects', 'MorkahjaWebApp'))
}
export function logDir(env = process.env) {
  const state = env.XDG_STATE_HOME?.trim() || path.join(homedir(), '.local', 'state')
  return path.join(state, 'babuni-admin', 'morkahja-dev')
}

const inside = (dir, root) => dir === root || dir.startsWith(root + path.sep)

/** Listening pids per port, from `ss`. */
export function parseListeners(output) {
  const result = new Map()
  for (const line of output.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 4) continue
    const port = Number(cols[3].slice(cols[3].lastIndexOf(':') + 1))
    if (!Number.isInteger(port)) continue
    const pids = [...line.matchAll(/pid=(\d+)/g)].map(m => Number(m[1]))
    result.set(port, [...new Set([...(result.get(port) || []), ...pids])])
  }
  return result
}

async function listeners() {
  const ports = DEV_STACK_PARTS.map(p => `sport = :${p.port}`).join(' or ')
  const { stdout } = await run('ss', ['-ltnpH', ports], { timeout: 5000 })
  return parseListeners(stdout)
}

async function processInfo(pid) {
  try {
    const cwd = await readlink(`/proc/${pid}/cwd`)
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8')
    const close = stat.lastIndexOf(')')
    const name = stat.slice(stat.indexOf('(') + 1, close)
    const ppid = Number(stat.slice(close + 2).split(' ')[1])
    return { pid, cwd, name, ppid }
  } catch { return null }
}

// npm and its `sh -c` wrappers sit above the listening node process; stop the
// whole chain up to (not including) the user's interactive shell or terminal.
const launcherNames = /^(MainThread|node(-\d+)?|npm( .*)?|sh|esbuild|tsx)$/

async function ownedChain(pid, repo) {
  const chain = []
  let info = await processInfo(pid)
  if (!info || !inside(info.cwd, repo)) return null
  while (info && info.pid > 1 && inside(info.cwd, repo) && launcherNames.test(info.name)) {
    chain.push(info.pid)
    info = await processInfo(info.ppid)
  }
  return chain
}

export async function devStackStatus(env = process.env) {
  const repo = morkahjaRepo(env)
  const byPort = await listeners()
  const parts = []
  for (const part of DEV_STACK_PARTS) {
    const pids = byPort.get(part.port) || []
    let state = 'stopped'
    if (pids.length) {
      const owned = await Promise.all(pids.map(pid => ownedChain(pid, repo)))
      state = owned.every(Boolean) ? 'running' : 'foreign'
    }
    parts.push({ id: part.id, label: part.label, port: part.port, state })
  }
  const running = parts.filter(p => p.state === 'running').length
  return {
    repo, logs: logDir(env), parts,
    state: running === parts.length ? 'running' : running === 0 ? 'stopped' : 'partial',
    checkedAt: new Date().toISOString(),
  }
}

function alive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

/** Environment of a fresh terminal: no Babuni Admin secrets, ports or npm state. */
export function gameEnv(base) {
  const env = {}
  for (const [key, value] of Object.entries(base)) {
    if (/^(BABUNI_|VITE_|MORKAHJA_|npm_)/i.test(key)) continue
    if (['PORT', 'NODE_ENV', 'INIT_CWD', 'DATABASE_URL', 'NODE_OPTIONS'].includes(key)) continue
    env[key] = value
  }
  env.PATH = (base.PATH || '').split(':').filter(dir => !dir.includes('babuni.admin')).join(':')
  return env
}

let active = false
export const isDevStackActive = () => active

export async function restartDevStack(env = process.env) {
  if (active) throw new Error('DEV_STACK_BUSY')
  active = true
  try {
    const repo = morkahjaRepo(env)
    try { JSON.parse(await readFile(path.join(repo, 'package.json'), 'utf8')) }
    catch { throw new Error('GAME_CHECKOUT_UNAVAILABLE') }

    // Stop what is ours; refuse to touch a port held by another program.
    const byPort = await listeners()
    const targets = new Set()
    for (const part of DEV_STACK_PARTS) {
      for (const pid of byPort.get(part.port) || []) {
        const chain = await ownedChain(pid, repo)
        if (!chain) throw new Error('PORT_HELD_BY_OTHER_PROGRAM')
        chain.forEach(p => targets.add(p))
      }
    }
    const stopped = targets.size
    for (const pid of targets) { try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ } }
    for (let i = 0; i < 50 && [...targets].some(alive); i++) await sleep(100)
    for (const pid of targets) { try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ } }
    for (let i = 0; i < 50; i++) {
      const now = await listeners()
      if (DEV_STACK_PARTS.every(p => !(now.get(p.port) || []).length)) break
      await sleep(100)
    }

    const logs = logDir(env)
    await mkdir(logs, { recursive: true })
    const childEnv = gameEnv(env)
    for (const part of DEV_STACK_PARTS) {
      const log = await open(path.join(logs, `${part.id}.log`), 'w')
      const child = spawn('npm', ['run', part.script], {
        cwd: repo, env: childEnv, detached: true, stdio: ['ignore', log.fd, log.fd],
      })
      child.on('error', () => {})
      child.unref()
      await log.close()
    }

    // Wait for both ports, up to 30 s.
    let status = await devStackStatus(env)
    for (let i = 0; i < 60 && status.state !== 'running'; i++) {
      await sleep(500)
      status = await devStackStatus(env)
    }
    return { ok: status.state === 'running', stopped, ...status }
  } finally { active = false }
}
