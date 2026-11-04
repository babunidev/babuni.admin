import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContentGrant, hasContentGrant } from '../local-service/contentGrant.mjs'
import { previewEntry, saveEntry, restoreEntry } from '../local-service/scopedGameEdits.mjs'

test('dataset grants, revisions, backup restore and audit use disposable content only',()=>{
  const root=mkdtempSync(join(tmpdir(),'babuni-content-scope-'))
  const game=join(root,'game')
  mkdirSync(game)
  const file=join(game,'encountersdata.json')
  const original='{"00001":{"mEncounterTitle":"Original"},"_meta":{"version":1}}\n'
  writeFileSync(file,original)
  writeFileSync(join(game,'solutiondata.json'),'{"00002":{"mSolutionTitle":"Original"}}\n')
  const profile={id:'6b71c714-9a25-4b3f-bb06-b9f78e635bf0',
    kind:'local-files',projectId:'morkahja',target:root}
  const oldGrant=process.env.BABUNI_TEST_CONTENT_GRANT_DIR
  const oldLog=process.env.BABUNI_TEST_ACTION_LOG_DIR
  const oldFailure=process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE
  process.env.BABUNI_TEST_CONTENT_GRANT_DIR=join(root,'grants')
  process.env.BABUNI_TEST_ACTION_LOG_DIR=join(root,'audit')
  try{
    const before=previewEntry(profile,'encounters','00001')
    assert.equal(before.record.mEncounterTitle,'Original')
    assert.throws(()=>saveEntry(profile,'encounters','00001',{
      expectedRevision:before.revision,data:{mEncounterTitle:'Edited'},confirm:true,
    }),/CONTENT_WRITE_NOT_AUTHORIZED/)
    createContentGrant(profile,'encounters')
    assert.equal(hasContentGrant(profile,'encounters'),true)
    assert.equal(hasContentGrant(profile,'solutions'),false)
    assert.throws(()=>saveEntry(profile,'solutions','00002',{
      expectedRevision:'a'.repeat(64),data:{mSolutionTitle:'Edited'},confirm:true,
    }),/CONTENT_WRITE_NOT_AUTHORIZED/)
    process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE='write-complete'
    assert.throws(()=>saveEntry(profile,'encounters','00001',{
      expectedRevision:before.revision,data:{mEncounterTitle:'Should roll back'},confirm:true,
    }),/WRITE_REVERTED_AUDIT_FAILURE/)
    assert.equal(readFileSync(file,'utf8'),original)
    delete process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE
    const saved=saveEntry(profile,'encounters','00001',{
      expectedRevision:before.revision,data:{mEncounterTitle:'Edited'},confirm:true,
    })
    assert.equal(saved.ok,true)
    assert.equal(saved.revision.length,64)
    assert.ok(saved.backup.startsWith('encountersdata.json.bak-'))
    assert.equal(JSON.parse(readFileSync(file,'utf8'))['00001'].mEncounterTitle,'Edited')
    assert.throws(()=>saveEntry(profile,'encounters','00001',{
      expectedRevision:before.revision,data:{mEncounterTitle:'Lost edit'},confirm:true,
    }),/REVISION_CONFLICT/)
    assert.throws(()=>saveEntry(profile,'encounters','00001',{
      expectedRevision:saved.revision,data:{mEncounterTitle:'Unconfirmed'},
    }),/CONFIRMATION_REQUIRED/)
    assert.throws(()=>restoreEntry(profile,'encounters','00001',{
      expectedRevision:saved.revision,backup:'../../elsewhere',confirm:true,
    }),/CONFIRMATION_REQUIRED/)
    process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE='restore-complete'
    assert.throws(()=>restoreEntry(profile,'encounters','00001',{
      expectedRevision:saved.revision,backup:saved.backup,confirm:true,
    }),/RESTORE_REVERTED_AUDIT_FAILURE/)
    assert.equal(JSON.parse(readFileSync(file,'utf8'))['00001'].mEncounterTitle,'Edited')
    delete process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE
    const restored=restoreEntry(profile,'encounters','00001',{
      expectedRevision:saved.revision,backup:saved.backup,confirm:true,
    })
    assert.equal(restored.restored,true)
    assert.equal(readFileSync(file,'utf8'),original)
    const audit=readFileSync(join(root,'audit','content-actions.jsonl'),'utf8')
    assert.ok(audit.includes('write-complete'))
    assert.ok(audit.includes('restore-complete'))
    assert.equal(audit.includes('Original'),false)
    assert.equal(audit.includes('Edited'),false)
    assert.equal((lstatSync(join(root,'audit','content-actions.jsonl')).mode&0o077),0)
    const grantFile=join(root,'grants',profile.id+'-encounters.json')
    const grant=JSON.parse(readFileSync(grantFile,'utf8'))
    grant.expiresAt=new Date(Date.now()-1000).toISOString()
    writeFileSync(grantFile,JSON.stringify(grant))
    assert.equal(hasContentGrant(profile,'encounters'),false)
    assert.throws(()=>saveEntry(profile,'encounters','00001',{
      expectedRevision:before.revision,data:{mEncounterTitle:'Expired'},confirm:true,
    }),/CONTENT_WRITE_NOT_AUTHORIZED/)
    assert.equal(readFileSync(file,'utf8'),original)
  } finally {
    if(oldGrant===undefined)delete process.env.BABUNI_TEST_CONTENT_GRANT_DIR
    else process.env.BABUNI_TEST_CONTENT_GRANT_DIR=oldGrant
    if(oldLog===undefined)delete process.env.BABUNI_TEST_ACTION_LOG_DIR
    else process.env.BABUNI_TEST_ACTION_LOG_DIR=oldLog
    if(oldFailure===undefined)delete process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE
    else process.env.BABUNI_TEST_AUDIT_FAILURE_TYPE=oldFailure
    rmSync(root,{recursive:true,force:true})
  }
})
test('symlinked game content cannot be altered by scoped editor',()=>{
  const root=mkdtempSync(join(tmpdir(),'babuni-content-links-'))
  const game=join(root,'game');mkdirSync(game)
  const outside=join(root,'outside.json')
  writeFileSync(outside,'{"x":{"name":"unchanged"}}')
  symlinkSync(outside,join(game,'encountersdata.json'))
  const profile={id:'bcaa9f3f-fdbe-4108-89e4-00542327254e',
    kind:'local-files',projectId:'morkahja',target:root}
  try{
    assert.throws(()=>previewEntry(profile,'encounters','x'),/UNSAFE_GAME_FILE/)
    assert.equal(readFileSync(outside,'utf8'),'{"x":{"name":"unchanged"}}')
  } finally {rmSync(root,{recursive:true,force:true})}
})
