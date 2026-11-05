import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,symlinkSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync,execFileSync} from 'node:child_process'

const script=resolve('scripts/verify-morkahja-deployed-catalog.py')
const valid=()=>({expansions:Object.fromEntries([1001,1002,1003,1004].map(id=>[
  String(id),{mExtensioID:id,mExtensioActive:id!==1002}
]))})
const withFixture=(payload,callback)=>{
  const dir=mkdtempSync(join(tmpdir(),'babuni-catalog-'))
  try {
    const path=join(dir,'expansiondata.json')
    writeFileSync(path,payload)
    return callback(path,dir)
  } finally {rmSync(dir,{recursive:true,force:true})}
}
const run=path=>spawnSync('python3',[script,path],{encoding:'utf8',timeout:5000})

test('operator catalog audit accepts exact IDs and reports inactive without names',()=>{
  withFixture(JSON.stringify(valid()),path=>{
    const result=run(path)
    assert.equal(result.status,0,result.stderr)
    assert.match(result.stdout,/CATALOG_IDS 1001,1002,1003,1004/)
    assert.match(result.stdout,/CATALOG_INACTIVE_IDS 1002/)
    assert.match(result.stdout,/CATALOG_MATCH/)
    assert.ok(!result.stdout.includes(path))
  })
})

test('catalog audit fails closed on missing, extra and mismatched IDs',()=>{
  for(const transform of [
    data=>{delete data.expansions['1002']},
    data=>{data.expansions['1005']={mExtensioID:1005,mExtensioActive:true}},
    data=>{data.expansions['1001'].mExtensioID=1009},
    data=>{data.expansions['1001'].mExtensioActive='true'},
  ]) {
    const data=valid();transform(data)
    withFixture(JSON.stringify(data),path=>{
      const result=run(path)
      assert.equal(result.status,1)
      assert.match(result.stdout,/CATALOG_(?:MISMATCH|ID_DISAGREEMENT|INVALID_ACTIVE_STATE)/)
      assert.ok(!result.stdout.includes(path))
    })
  }
})

test('catalog audit refuses symbolic links and duplicate JSON keys',()=>{
  withFixture(JSON.stringify(valid()),(path,dir)=>{
    const link=join(dir,'alias.json')
    symlinkSync(path,link)
    assert.equal(run(link).status,1)
    assert.match(run(link).stdout,/CATALOG_UNREADABLE/)
  })
  withFixture('{"expansions":{},"expansions":{}}',path=>{
    const result=run(path)
    assert.equal(result.status,1)
    assert.match(result.stdout,/CATALOG_DUPLICATE_KEY/)
  })
})

test('catalog audit refuses a named pipe instead of blocking on it',()=>{
  withFixture(JSON.stringify(valid()),(_path,dir)=>{
    const fifo=join(dir,'untrusted.pipe')
    execFileSync('mkfifo',[fifo])
    const result=run(fifo)
    assert.equal(result.status,1)
    assert.match(result.stdout,/CATALOG_UNSAFE_FILE/)
  })
})

test('candidate ID allowlist matches the prepared restricted-view SQL',()=>{
  const sql=readFileSync('scripts/morkahja-batch-a-aggregate-views.sql','utf8')
  assert.match(sql,/item::text IN \('1001', '1002', '1003', '1004'\)/)
  const source=readFileSync(script,'utf8')
  assert.match(source,/EXPECTED_IDS = frozenset\(\("1001", "1002", "1003", "1004"\)\)/)
})
