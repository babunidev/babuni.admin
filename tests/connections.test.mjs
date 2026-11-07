import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
    assert.throws(()=>registry.add({projectId:'morkahja',kind:'postgres-ssh',displayName:'Bad SSH',target:'bad..host'}), /INVALID_PROFILE/)
    const sshProfile=registry.add({projectId:'morkahja',kind:'postgres-ssh',displayName:'Offline SSH',target:'morkahja.example.invalid'})
    assert.equal(sshProfile.enabled,false)
    assert.equal(registry.remove(sshProfile.id),true)
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

test('switching branches preserves unknown Morkahja connection profiles without enabling them', async () => {
  const root = mkdtempSync(join(tmpdir(), 'babuni-profile-compat-'))
  const file = join(root, 'connections.json')
  let vite
  try {
    const retained = [
      { id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',projectId:'morkahja',
        kind:'postgres-ssh',displayName:'Morkahja server',target:'example.invalid',
        enabled:false,createdAt:'2026-11-04T10:00:00.000Z' },
      { id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',projectId:'morkahja',
        kind:'postgres-ssh-moderation',displayName:'Morkahja administrator',
        target:'example.invalid',enabled:false,createdAt:'2026-11-05T10:00:00.000Z' },
      { id:'cccccccc-cccc-4ccc-cccc-cccccccccccc',projectId:'morkahja',
        kind:'ssh-content',displayName:'Morkahja content',
        target:'example.invalid',enabled:false,createdAt:'2026-11-05T10:00:00.000Z' },
    ]
    writeFileSync(file,JSON.stringify(retained,null,2)+'\n')
    vite = await createServer({ configFile:false, server:{middlewareMode:true}, logLevel:'error' })
    const { LocalConnectionRegistry } = await vite.ssrLoadModule('/vite/localConnectionRegistry.ts')
    const { specForProfile } = await vite.ssrLoadModule('/vite/connectionAdapters.ts')
    const registry = new LocalConnectionRegistry(file)
    assert.equal(registry.list().length,3)
    for(const profile of registry.list().filter(p=>p.kind!=='postgres-ssh')){
      const spec = specForProfile(profile)
      assert.equal(spec.transport,'planned')
      assert.deepEqual(spec.capabilities,[])
    }
    assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),retained)
    registry.add({projectId:'babuni-dev',kind:'github',
      displayName:'Website source',target:'babunidev/babuni.dev'})
    assert.deepEqual(JSON.parse(readFileSync(file,'utf8')).slice(0,3),retained)
    assert.equal(new LocalConnectionRegistry(file).list().length,4)
    assert.throws(()=>registry.add({projectId:'babuni-dev',kind:'postgres-ssh-moderation',
      displayName:'Invalid cross-project',target:'example.invalid'}),/INVALID_PROFILE/)
  } finally {
    await vite?.close()
    rmSync(root,{recursive:true,force:true})
  }
})
