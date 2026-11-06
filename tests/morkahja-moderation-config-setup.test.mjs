import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

test('moderation config preparation copies only approved metadata and refuses overwrite',()=>{
  const root=mkdtempSync(join(tmpdir(),'babuni-moderation-setup-'))
  try {
    const source=join(root,'probe.json'),target=join(root,'moderation.json')
    const config={
      enabled:true,host:'approved.example.invalid',sshUser:'operator',sshPort:22,
      sshIdentityFile:'/home/operator/.ssh/approved',dbUser:'babuni_admin_probe',
      dbName:'actual_live_db',dbPort:5432,
      approvedHostKeyFingerprint:'SHA256:'+'a'.repeat(43),
      readOnlyDataEnabled:true,readOnlyDataFields:[
        'displayName','avatarCount','lastPlayedAt'],
      readOnlyMetricFields:['achievementsUnlocked','playersWithAchievements',
        'diceUnlocks','expansionUnlocks'],
    }
    writeFileSync(source,JSON.stringify(config),{mode:0o600})
    const command=(...args)=>spawnSync('python3',[
      'scripts/prepare-morkahja-moderation-config.py',
      '--source',source,'--destination',target,...args],{encoding:'utf8'})
    const check=command()
    assert.equal(check.status,0,check.stderr)
    assert.match(check.stdout,/DB_NAME=actual_live_db/)
    assert.equal(existsSync(target),false)
    const first=command('--create')
    assert.equal(first.status,0,first.stderr)
    const created=JSON.parse(readFileSync(target,'utf8'))
    assert.equal(created.dbUser,'babuni_admin')
    assert.equal(created.dbName,'actual_live_db')
    assert.equal(created.enabled,true)
    assert.equal(created.readOnlyDataEnabled,undefined)
    assert.equal(created.readOnlyMetricFields,undefined)
    assert.equal(Object.keys(created).length,9)
    assert.equal(command('--create').status,1,'Never overwrite a private operator file')
    assert.deepEqual(JSON.parse(readFileSync(target,'utf8')),created)
    chmodSync(source,0o644)
    assert.notEqual(command().status,0,'Reject world-readable source')
  } finally {
    rmSync(root,{recursive:true,force:true})
  }
})
