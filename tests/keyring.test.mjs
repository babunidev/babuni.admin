import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { credentialStatus, storeCredential, clearCredential, keyringHealth, verifyCredential } from '../local-service/keyring.mjs'

test('OS keyring boundary stores secrets only through stdin and returns status, not secret values', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'babuni-keyring-'))
  const mockBin = join(dir,'secret-tool')
  const mockFile = join(dir,'secret')
  const mockArguments = join(dir,'arguments')
  // Disposable command fixture: it is deliberately not a real credential store.
  writeFileSync(mockBin, `#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
const args = process.argv.slice(2)
if (process.env.BABUNI_KEYRING_LOCKED === '1') { process.stderr.write('Keyring locked'); process.exit(2) }
writeFileSync(process.env.BABUNI_KEYRING_ARGS, JSON.stringify(args))
if (args[0] === 'lookup') {
  if (existsSync(process.env.BABUNI_KEYRING_FILE)) process.stdout.write(readFileSync(process.env.BABUNI_KEYRING_FILE))
  else process.exitCode = 1
} else if (args[0] === 'store') {
  writeFileSync(process.env.BABUNI_KEYRING_FILE, readFileSync(0))
} else if (args[0] === 'clear') {
  if (existsSync(process.env.BABUNI_KEYRING_FILE)) unlinkSync(process.env.BABUNI_KEYRING_FILE)
} else process.exitCode = 2
`)
  chmodSync(mockBin,0o700)
  const original = {
    binary:process.env.BABUNI_SECRET_TOOL_BIN,
    file:process.env.BABUNI_KEYRING_FILE,
    args:process.env.BABUNI_KEYRING_ARGS,
  }
  process.env.BABUNI_SECRET_TOOL_BIN=mockBin
  process.env.BABUNI_KEYRING_FILE=mockFile
  process.env.BABUNI_KEYRING_ARGS=mockArguments
  const profile={id:'a72e405e-d30b-4328-a1aa-68b78540c0d4',kind:'github'}
  try {
    assert.equal(await credentialStatus(profile),'missing')
    assert.equal(await keyringHealth(),'available')
    await storeCredential(profile,'synthetic-test-only-value')
    assert.equal(await credentialStatus(profile),'stored')
    assert.equal(await verifyCredential(profile,'synthetic-test-only-value'),true)
    assert.equal(await verifyCredential(profile,'incorrect-value'),false)
    assert.equal(readFileSync(mockFile,'utf8'),'synthetic-test-only-value')
    assert.equal(readFileSync(mockArguments,'utf8').includes('synthetic-test-only-value'),false)
    await clearCredential(profile)
    assert.equal(await credentialStatus(profile),'missing')
    await assert.rejects(storeCredential(profile,'line\npassword'), /INVALID_CREDENTIAL/)
    assert.equal(await credentialStatus({id:profile.id,kind:'local-files'}),'not-required')
    process.env.BABUNI_KEYRING_LOCKED='1'
    assert.equal(await credentialStatus(profile),'unavailable')
    await assert.rejects(storeCredential(profile,'synthetic'),/KEYRING_UNAVAILABLE/)
    delete process.env.BABUNI_KEYRING_LOCKED
    process.env.BABUNI_SECRET_TOOL_BIN=join(dir,'does-not-exist')
    assert.equal(await credentialStatus(profile),'unavailable')
    assert.equal(await keyringHealth(),'unavailable')
  } finally {
    delete process.env.BABUNI_KEYRING_LOCKED
    for (const [key,value] of [['BABUNI_SECRET_TOOL_BIN',original.binary],['BABUNI_KEYRING_FILE',original.file],['BABUNI_KEYRING_ARGS',original.args]]) {
      if (value === undefined) delete process.env[key]; else process.env[key]=value
    }
    rmSync(dir,{recursive:true,force:true})
  }
})
