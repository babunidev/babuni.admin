import { spawn } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'

const attributes = id => ['application', 'babuni.admin', 'profile-id', id]
const isId = id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
export const requiresCredential = profile => profile.kind !== 'local-files'

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
  return status === 'unavailable' ? 'unavailable' : 'available'
}

export async function storeCredential(profile, secret) {
  if (!requiresCredential(profile) || !isId(profile.id) ||
      typeof secret !== 'string' || secret.length < 1 || secret.length > 4096 ||
      /[\r\n\0]/.test(secret)) throw new Error('INVALID_CREDENTIAL')
  // The secret is sent only through stdin, never process arguments, environment or the browser.
  const result = await runSecretTool(['store', '--label=Babuni Admin connection credential', ...attributes(profile.id)], secret)
  if (result.code !== 0) throw new Error('KEYRING_UNAVAILABLE')
}

export async function clearCredential(profile) {
  if (!requiresCredential(profile)) return
  if (!isId(profile.id)) throw new Error('INVALID_PROFILE')
  const status = await credentialStatus(profile)
  if (status === 'missing') return
  if (status !== 'stored') throw new Error('KEYRING_UNAVAILABLE')
  const result = await runSecretTool(['clear', ...attributes(profile.id)])
  if (result.code !== 0) throw new Error('KEYRING_UNAVAILABLE')
}

/** Used only for an operator-initiated ephemeral self-test; never returns credential bytes. */
export async function verifyCredential(profile, expected) {
  if (!requiresCredential(profile) || !isId(profile.id) || typeof expected!=='string') return false
  try {
    const result=await runSecretTool(['lookup',...attributes(profile.id)])
    if (result.code!==0) return false
    const actual=Buffer.from(result.stdout)
    const wanted=Buffer.from(expected)
    return actual.length===wanted.length && timingSafeEqual(actual,wanted)
  } catch {return false}
}

/** Server-only. Returns credential bytes to the protected local service, never the HTTP client.
 * No secret may be passed via shell arguments, environment or logs. */
export async function readCredential(profile) {
  if (!requiresCredential(profile) || !isId(profile.id)) throw Error('INVALID_PROFILE')
  let value
  try { value=await runSecretTool(['lookup',...attributes(profile.id)]) }
  catch {throw Error('KEYRING_UNAVAILABLE')}
  if(value.code===1)throw Error('DB_CREDENTIAL_MISSING')
  if(value.code!==0)throw Error('KEYRING_UNAVAILABLE')
  // secret-tool emits one terminal newline; passwords themselves cannot contain a newline.
  const secret=value.stdout.endsWith('\n')?value.stdout.slice(0,-1):value.stdout
  if(!secret)throw Error('DB_CREDENTIAL_MISSING')
  return secret
}
