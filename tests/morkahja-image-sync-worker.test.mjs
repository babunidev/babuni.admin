import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFile,mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const file='scripts/morkahja-image-cache-sync.py'

async function runWorker(root,cached={}) {
  const source=await readFile(file,'utf8')
  const content='CACHED_JSON='+JSON.stringify(JSON.stringify(cached))+'\n'+
    source.replace('ROOT = "/var/www/morkahja"', 'ROOT = '+JSON.stringify(root))
  const proc=spawnSync('python3',['-'],{
    input:content,encoding:'utf8',maxBuffer:4*1024*1024,timeout:5000,
  })
  assert.equal(proc.status,0,proc.stderr)
  return proc.stdout.trim().split('\n').map(line=>JSON.parse(line))
}

test('deployed SSH Python worker sends WebP once and metadata only after cache match',async()=>{
  const root=await mkdtemp(join(tmpdir(),'babuni-image-worker-'))
  try {
    const path=join(root,'game','encounterimages')
    await mkdir(path,{recursive:true})
    const bytes=Buffer.from('RIFF\0\0\0\0WEBPtest-image')
    await writeFile(join(path,'first.webp'),bytes)
    await writeFile(join(path,'ignore.txt'),Buffer.from('secret'))
    await symlink(join(path,'first.webp'),join(path,'link.webp'))
    const first=await runWorker(root)
    const loaded=first.filter(record=>record.type==='file')
    assert.equal(loaded.length,1)
    assert.equal(loaded[0].kind,'encounter')
    assert.equal(loaded[0].name,'first.webp')
    assert.equal(Buffer.from(loaded[0].base64,'base64').toString(),bytes.toString())
    assert.equal(first.at(-1).type,'complete')
    const cached={'encounter/first.webp':loaded[0].meta}
    const second=await runWorker(root,cached)
    assert.equal(second.filter(record=>record.type==='file').length,0)
    assert.equal(second.filter(record=>record.type==='keep').length,1)
    // Update the actual file, then ensure only changed bytes cross SSH.
    await writeFile(join(path,'first.webp'),Buffer.from('RIFF\0\0\0\0WEBPupdated-image-longer'))
    const third=await runWorker(root,cached)
    assert.equal(third.filter(record=>record.type==='file').length,1)
    assert.equal(third.at(-1).type,'complete')
  }finally {await rm(root,{recursive:true,force:true})}
})
