import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

test('connection profiles are private metadata, remain disabled and persist locally', async () => {
  const root = mkdtempSync(join(tmpdir(), 'babuni-connection-'))
  const file = join(root, 'profiles.json')
  let vite
  try {
    vite = await createServer({ configFile: false, server: { middlewareMode: true }, logLevel: 'error' })
    const { LocalConnectionRegistry } = await vite.ssrLoadModule('/vite/localConnectionRegistry.ts')
    const registry = new LocalConnectionRegistry(file)
    assert.deepEqual(registry.list(), [])
    const created = registry.add({projectId:'morkahja',kind:'local-files',displayName:'Fixture files',target:'/tmp/fixture-game'})
    assert.equal(created.state, 'not-configured')
    assert.equal(created.enabled, false)
    assert.equal(new LocalConnectionRegistry(file).list().length, 1)
    assert.equal(JSON.parse(readFileSync(file, 'utf8'))[0].displayName, 'Fixture files')
    assert.throws(()=>registry.add({projectId:'babuni-dev',kind:'local-files',displayName:'Wrong project',target:'/tmp/x'}), /INVALID_PROFILE/)
    assert.throws(()=>registry.add({projectId:'babuni-dev',kind:'github',displayName:'Unsafe',target:'https://token@github.com'}), /INVALID_PROFILE/)
    assert.throws(()=>registry.add({projectId:'babuni-dev',kind:'github',displayName:'Secret',target:'babunidev/test', token:'secret'}), /UNKNOWN_FIELDS/)
    assert.throws(()=>registry.add({projectId:'morkahja',kind:'postgres-ssh',displayName:'Credential URL',target:'postgresql://user:pass@host'}), /INVALID_PROFILE/)
    const edited=registry.update(created.id,{displayName:'Renamed files',target:'/tmp/other-fixture'})
    assert.equal(edited.displayName,'Renamed files')
    assert.equal(edited.id,created.id)
    assert.equal(new LocalConnectionRegistry(file).list()[0].target,'/tmp/other-fixture')
    assert.throws(()=>registry.update(created.id,{displayName:'Wrong',target:'/tmp/x',kind:'github'}),/UNKNOWN_FIELDS/)
    assert.throws(()=>registry.update(created.id,{displayName:'Wrong',target:'https://token@host'}),/INVALID_PROFILE/)
    assert.equal(registry.update('12345678-1234-1234-1234-123456789abc',{displayName:'None',target:'/tmp/x'}),null)
    assert.equal(registry.remove(created.id),true)
    assert.deepEqual(new LocalConnectionRegistry(file).list(), [])
    assert.equal(registry.remove(created.id),false)
  } finally { await vite?.close(); rmSync(root,{recursive:true,force:true}) }
})
