import { spawn } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'

const attributes = id => ['application', 'babuni.admin', 'profile-id', id]
const isId = id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
export const requiresCredential = profile => profile.kind !== 'local-files'

/**
 * Read only the Secret Service default collection's Locked property through D-Bus.
 * This operation cannot unlock a keyring or read any stored credential.
 * Providers without busctl/collection introspection return "unknown".
 */
export async function defaultCollectionLockState() {
  // The disposable secret-tool fixture is independent of the real desktop bus.
  if (process.env.BABUNI_SECRET_TOOL_BIN && !process.env.BABUNI_BUSCTL_BIN) return 'unknown'
  const binary = process.env.BABUNI_BUSCTL_BIN || 'busctl'
  async function call(args) {
    return new Promise((resolve,reject) => {
      let out = ''
      const child = spawn(binary, ['--user', ...args], {
        stdio: ['ignore','pipe','ignore'], shell: false,
      })
      let done = false
      const timeout = setTimeout(() => child.kill('SIGKILL'), 2000)
      child.stdout.on('data', chunk => {
        out += chunk.toString('utf8').slice(0, 512 - out.length)
      })
      child.on('error', () => {
        if (!done) { done=true; clearTimeout(timeout); reject(new Error('BUS_UNAVAILABLE')) }
      })
      child.on('close', (code,signal) => {
        if (done) return
        done=true
        clearTimeout(timeout)
        if (code!==0 || signal) reject(new Error('BUS_UNAVAILABLE'))
        else resolve(out.trim())
      })
    })
  }
  try {
    const alias=await call(['call','org.freedesktop.secrets','/org/freedesktop/secrets',
      'org.freedesktop.Secret.Service','ReadAlias','s','default'])
    const match=/^o "((?:\/org\/freedesktop\/secrets\/)[A-Za-z0-9_/-]+)"$/.exec(alias)
    if (!match) return 'unknown'
    const state=await call(['get-property','org.freedesktop.secrets',match[1],
      'org.freedesktop.Secret.Collection','Locked'])
    if (state==='b true') return 'locked'
    if (state==='b false') return 'unlocked'
    return 'unknown'
  } catch { return 'unknown' }
}


function runSecretTool(args, secret) {
  return new Promise((resolve, reject) => {
    // Only the operator's environment may select the executable; no HTTP input controls it.
    const binary = process.env.BABUNI_SECRET_TOOL_BIN || 'secret-tool'
    const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false })
    let stdout = ''
    let stderr = ''
    let finished = false
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000)
    child.on('error', () => {
      if (!finished) { finished = true; clearTimeout(timeout); reject(new Error('KEYRING_UNAVAILABLE')) }
    })
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8').slice(0, 8192 - stdout.length) })
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8').slice(0, 1024 - stderr.length) })
    child.on('close', (code, signal) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      if (signal || stderr.trim()) reject(new Error('KEYRING_UNAVAILABLE'))
      else resolve({ code, stdout })
    })
    child.stdin.on('error', () => {}) // A failed process may close stdin before a write completes.
    child.stdin.end(secret === undefined ? '' : secret)
  })
}

export async function credentialStatus(profile) {
  if (!requiresCredential(profile)) return 'not-required'
  if (!isId(profile.id)) return 'unavailable'
  if (await defaultCollectionLockState() === 'locked') return 'locked'
  try {
    const result = await runSecretTool(['lookup', ...attributes(profile.id)])
    if (result.code === 0) return result.stdout.trim() ? 'stored' : 'missing'
    if (result.code === 1 && !result.stdout.trim()) return 'missing'
    return 'unavailable'
  } catch { return 'unavailable' }
}

export async function keyringHealth() {
  // A lookup for a reserved, never-used ID checks Secret Service without reading any real credential.
  const status = await credentialStatus({ id: '00000000-0000-0000-0000-000000000000', kind: 'github' })
  return status === 'locked' ? 'locked' : status === 'unavailable' ? 'unavailable' : 'available'
}

export async function storeCredential(profile, secret) {
  if (!requiresCredential(profile) || !isId(profile.id) ||
      typeof secret !== 'string' || secret.length < 1 || secret.length > 4096 ||
      /[\r\n\0]/.test(secret)) throw new Error('INVALID_CREDENTIAL')
  if (await defaultCollectionLockState() === 'locked') throw new Error('KEYRING_LOCKED')
  // The secret is sent only through stdin, never process arguments, environment or the browser.
  const result = await runSecretTool(['store', '--label=Babuni Admin connection credential', ...attributes(profile.id)], secret)
  if (result.code !== 0) throw new Error('KEYRING_UNAVAILABLE')
}

export async function clearCredential(profile) {
  if (!requiresCredential(profile)) return
  if (!isId(profile.id)) throw new Error('INVALID_PROFILE')
  const status = await credentialStatus(profile)
  if (status === 'missing') return
  if (status === 'locked') throw new Error('KEYRING_LOCKED')
  if (status !== 'stored') throw new Error('KEYRING_UNAVAILABLE')
  const result = await runSecretTool(['clear', ...attributes(profile.id)])
  if (result.code !== 0) throw new Error('KEYRING_UNAVAILABLE')
}

/** Privileged local service only: returns a DB password for an in-process
 * health probe. Never send it to the browser, logs or child-process argv. */
export async function readCredentialForService(profile) {
  if (!requiresCredential(profile) || !isId(profile.id)) throw new Error('KEYRING_UNAVAILABLE')
  const lock=await defaultCollectionLockState()
  if (lock==='locked') throw new Error('KEYRING_LOCKED')
  if (lock!=='unlocked') throw new Error('KEYRING_UNKNOWN')
  let result
  try { result=await runSecretTool(['lookup',...attributes(profile.id)]) }
  catch { throw new Error('KEYRING_UNAVAILABLE') }
  if (result.code===1 && !result.stdout) throw new Error('KEYRING_CREDENTIAL_MISSING')
  if (result.code!==0 || result.stdout.length<1 || result.stdout.length>4096 ||
      /[\r\n\0]/.test(result.stdout)) throw new Error('KEYRING_UNAVAILABLE')
  return result.stdout
}

/** Used only for an operator-initiated ephemeral self-test; never returns credential bytes. */
export async function verifyCredential(profile, expected) {
  if (!requiresCredential(profile) || !isId(profile.id) || typeof expected!=='string') return false
  if (await defaultCollectionLockState() === 'locked') return false
  try {
    const result=await runSecretTool(['lookup',...attributes(profile.id)])
    if (result.code!==0) return false
    const actual=Buffer.from(result.stdout)
    const wanted=Buffer.from(expected)
    return actual.length===wanted.length && timingSafeEqual(actual,wanted)
  } catch {return false}
}
