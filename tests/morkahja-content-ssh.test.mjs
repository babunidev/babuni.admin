import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {validateContentRequest,buildContentSshArgs,performMorkahjaContent} from
  '../local-service/morkahjaContentRunner.mjs'
import {hasCapability} from '../vite/connectionAdapters.ts'

// Runs the actual SSH-worker business logic against disposable private files.
// It never contacts the game host or changes a live catalog.
const script=[
  'import importlib.util,json,sys',
  'from pathlib import Path',
  'spec=importlib.util.spec_from_file_location("worker","scripts/morkahja-content-ssh-worker.py")',
  'm=importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(m)',
  'try:',
  '  result=m.process(json.load(sys.stdin),Path(sys.argv[1]))',
  'except m.ContentError as error:',
  '  result={"ok":False,"code":str(error)}',
  'print(json.dumps(result))',
].join('\n')
function worker(root,req) {
  return JSON.parse(execFileSync('python3',['-c',script,root],{
    input:JSON.stringify(req),encoding:'utf8',timeout:5000,
  }))
}
test('content SSH permissions are independent from overview and moderator profiles',()=>{
  const p={projectId:'morkahja',kind:'ssh-content'}
  assert.equal(hasCapability(p,'ssh:content'),true)
  assert.equal(hasCapability({...p,kind:'postgres-ssh'},'ssh:content'),false)
  assert.equal(hasCapability({...p,kind:'postgres-ssh-moderation'},'ssh:content'),true)
  assert.equal(hasCapability(p,'ssh:moderation'),false)
})
test('content requests are exact and bounded; SSH command has no browser path',()=>{
  assert.deepEqual(validateContentRequest({action:'read',kind:'encounters'}),
    {action:'read',kind:'encounters'})
  for(const request of [
    {action:'read',kind:'../secret'},
    {action:'read',kind:'encounters',path:'../../private'},
    {action:'write',kind:'encounters',key:'a',data:{mEncounterID:1},expectedRevision:'bad'},
  ])assert.throws(()=>validateContentRequest(request))
  const args=buildContentSshArgs({host:'test.example.invalid',sshPort:22,
    sshIdentityFile:'/tmp/key',sshUser:'test'})
  assert.equal(args.at(-1),'/usr/bin/python3 -')
  assert.equal(args.includes('-T'),true)
  assert.equal(args.includes('-N'),false)
})
test('read, backed-up write and stale revision conflict preserve catalog integrity',()=>{
  const dir=mkdtempSync(join(tmpdir(),'babuni-content-fixture-'))
  try {
    const catalog=join(dir,'encountersdata.json')
    writeFileSync(catalog,JSON.stringify({'00001':{mEncounterID:1,mEncounterTitle:'Original'}})+'\n')
    const original=readFileSync(catalog,'utf8')
    const fetched=worker(dir,{action:'read',kind:'encounters'})
    assert.equal(fetched.ok,true)
    assert.equal(fetched.data['00001'].mEncounterTitle,'Original')
    const written=worker(dir,{action:'write',kind:'encounters',key:'00002',
      data:{mEncounterID:2,mEncounterTitle:'New encounter'},
      expectedRevision:fetched.revision})
    assert.equal(written.ok,true)
    assert.notEqual(written.revision,fetched.revision)
    const current=JSON.parse(readFileSync(catalog,'utf8'))
    assert.equal(current['00001'].mEncounterTitle,'Original')
    assert.equal(current['00002'].mEncounterTitle,'New encounter')
    const backups=readdirSync(dir).filter(f=>f.startsWith('encountersdata.json.bak.'))
    assert.equal(backups.length,1)
    assert.equal(readFileSync(join(dir,backups[0]),'utf8'),original)
    const conflicting=worker(dir,{action:'write',kind:'encounters',key:'00001',
      data:{mEncounterID:1,mEncounterTitle:'Stale'},
      expectedRevision:fetched.revision})
    assert.deepEqual(conflicting,{ok:false,code:'CONTENT_CONFLICT'})
    assert.deepEqual(JSON.parse(readFileSync(catalog,'utf8')),current)
    const rejected=worker(dir,{action:'write',kind:'encounters',key:'../../secret',
      data:{mEncounterID:3,mEncounterTitle:'Untrusted'},
      expectedRevision:written.revision})
    assert.equal(rejected.code,'CONTENT_INVALID_REQUEST')
  } finally {rmSync(dir,{recursive:true,force:true})}
})
test('runner refuses disabled content configuration without spawning SSH',async()=>{
  let ran=false
  const result=await performMorkahjaContent(
    {kind:'ssh-content',projectId:'morkahja'},
    {action:'read',kind:'frames'},{
      readConfig:async()=>({ok:false,code:'REMOTE_CONTENT_DISABLED'}),
      run:async()=>{ran=true},
    })
  assert.equal(result.code,'REMOTE_CONTENT_DISABLED')
  assert.equal(ran,false)
})
