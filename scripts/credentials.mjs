#!/usr/bin/env node
// Credentials never pass through browser configuration, command arguments or env variables.
import { LocalConnectionRegistry } from '../vite/localConnectionRegistry.ts'
import { credentialStatus, storeCredential, clearCredential, requiresCredential } from '../local-service/keyring.mjs'

const [command, id] = process.argv.slice(2)
function usage() {
  console.log('Usage: node --experimental-strip-types scripts/credentials.mjs list|status <profile-id>|set <profile-id>|clear <profile-id>')
}
const registry = new LocalConnectionRegistry()
if (command === 'list' && !id) {
  for (const p of registry.list()) console.log(p.id, p.projectId, p.kind, p.displayName)
  process.exit(0)
}
if (!['set','clear','status'].includes(command) || !id) { usage(); process.exit(2) }
const profile = registry.list().find(p => p.id === id)
if (!profile || !requiresCredential(profile)) {
  console.error('No credential-capable profile found for that ID.')
  process.exit(2)
}

async function hiddenPrompt() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('INTERACTIVE_TERMINAL_REQUIRED')
  process.stdout.write('Enter credential (hidden; never pasted into a command): ')
  const stdin = process.stdin
  const oldRaw = stdin.isRaw
  stdin.setRawMode(true)
  stdin.resume()
  try {
    return await new Promise((resolve, reject) => {
      let secret = ''
      const finish = (error) => {
        stdin.off('data', onData)
        process.stdout.write('\n')
        if (error) reject(error)
        else resolve(secret)
      }
      const onData = data => {
        for (const char of data.toString('utf8')) {
          if (char === '\r' || char === '\n') return finish()
          if (char === '\u0003' || char === '\u001b') return finish(new Error('CANCELLED'))
          if (char === '\u007f' || char === '\b') secret = Array.from(secret).slice(0,-1).join('')
          else if (char >= ' ' && secret.length < 4096) secret += char
        }
      }
      stdin.on('data', onData)
    })
  } finally {
    stdin.setRawMode(Boolean(oldRaw))
    stdin.pause()
  }
}

try {
  if (command === 'status') console.log('Credential:', await credentialStatus(profile))
  if (command === 'set') {
    const value = await hiddenPrompt()
    await storeCredential(profile, value)
    console.log('Credential stored in the Linux OS keyring. No connection attempted.')
  }
  if (command === 'clear') {
    await clearCredential(profile)
    console.log('Credential cleared from the OS keyring.')
  }
} catch (error) {
  // Error codes only: no credential content or underlying keyring stderr is printed.
  console.error('Credential operation failed:', error.message === 'CANCELLED' ? 'CANCELLED' :
    error.message === 'INTERACTIVE_TERMINAL_REQUIRED' ? 'INTERACTIVE_TERMINAL_REQUIRED' :
    error.message === 'INVALID_CREDENTIAL' ? 'INVALID_CREDENTIAL' : 'KEYRING_UNAVAILABLE')
  process.exitCode = 1
}
