import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile,mkdtemp,mkdir,writeFile,rm,symlink,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {imageWriteRequest,writeMorkahjaImage,checkPublicImage} from '../local-service/morkahjaImageWrite.mjs'

const webp=text=>Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP'),Buffer.from(text)])

async function runWorker(root,request) {
  const source=await readFile('scripts/morkahja-image-write-worker.py','utf8')
  assert.match(source,/^ROOT = "\/var\/www\/morkahja"$/m)
  const payload=Buffer.from(JSON.stringify(request)).toString('base64')
  const proc=spawnSync('python3',['-'],{
    input:"REQUEST_BASE64 = '"+payload+"'\n"+
      source.replace('ROOT = "/var/www/morkahja"','ROOT = '+JSON.stringify(root)),
    encoding:'utf8',timeout:5000,
  })
  assert.equal(proc.status,0,proc.stderr)
  return JSON.parse(proc.stdout)
}

test('image worker adds, numbers and replaces files only inside the fixed folder',async()=>{
  const root=await mkdtemp(join(tmpdir(),'babuni-image-write-'))
  try {
    const folder=join(root,'game','encounterimages')
    await mkdir(folder,{recursive:true})
    const first=webp('one')
    const added=await runWorker(root,{kind:'encounter',mode:'unique',base:'moonlit_oasis',
      data:first.toString('base64')})
    assert.deepEqual({...added,sha256:undefined},{ok:true,name:'moonlit_oasis.webp',replaced:false,sha256:undefined})
    assert.equal(added.sha256,createHash('sha256').update(first).digest('hex'))
    assert.equal((await stat(join(folder,'moonlit_oasis.webp'))).mode & 0o777,0o644)

    const second=await runWorker(root,{kind:'encounter',mode:'unique',base:'moonlit_oasis',
      data:webp('two').toString('base64')})
    assert.equal(second.name,'2_moonlit_oasis.webp')
    assert.equal((await readFile(join(folder,'moonlit_oasis.webp'))).toString(),first.toString())

    const replaced=await runWorker(root,{kind:'encounter',mode:'exact',base:'moonlit_oasis',
      data:webp('three').toString('base64')})
    assert.equal(replaced.replaced,true)
    assert.match((await readFile(join(folder,'moonlit_oasis.webp'))).toString(),/three$/)

    await symlink('/etc/passwd',join(folder,'linked.webp'))
    const unsafe=await runWorker(root,{kind:'encounter',mode:'exact',base:'linked',
      data:webp('x').toString('base64')})
    assert.equal(unsafe.code,'IMAGE_TARGET_UNSAFE')
    for(const bad of [
      {kind:'encounter',mode:'exact',base:'../escape',data:webp('x').toString('base64')},
      {kind:'secrets',mode:'exact',base:'a',data:webp('x').toString('base64')},
      {kind:'encounter',mode:'exact',base:'a',data:Buffer.from('not an image').toString('base64')},
    ]) assert.equal((await runWorker(root,bad)).ok,false)
    const missing=await runWorker(root,{kind:'solution',mode:'exact',base:'a',data:webp('x').toString('base64')})
    assert.equal(missing.code,'IMAGE_FOLDER_UNAVAILABLE')
  } finally {await rm(root,{recursive:true,force:true})}
})

test('image requests accept only a kind, a base name and WebP bytes',()=>{
  const base64=webp('x').toString('base64')
  assert.equal(imageWriteRequest({kind:'portrait',mode:'exact',name:'avatar_12.webp',base64}).base,'avatar_12')
  assert.throws(()=>imageWriteRequest({kind:'portrait',mode:'exact',name:'../a',base64}),/INVALID_IMAGE_NAME/)
  assert.throws(()=>imageWriteRequest({kind:'portrait',mode:'exact',name:'a',base64,path:'/etc'}),/INVALID_IMAGE_REQUEST/)
  assert.throws(()=>imageWriteRequest({kind:'portrait',mode:'any',name:'a',base64}),/INVALID_IMAGE_REQUEST/)
  assert.throws(()=>imageWriteRequest({kind:'portrait',mode:'exact',name:'a',
    base64:Buffer.from('plain').toString('base64')}),/IMAGE_NOT_WEBP/)
})

test('an upload reports the server write and the public check separately',async()=>{
  const bytes=webp('pic')
  const sha=createHash('sha256').update(bytes).digest('hex')
  const deps={
    readConfig:async()=>({ok:true,config:{}}),
    run:async(_config,request)=>({ok:true,name:request.base+'.webp',sha256:sha,replaced:false}),
    checkPublic:async(kind,name)=>({url:'https://example.test/'+kind+'/'+name,ok:true,status:200}),
  }
  const report=await writeMorkahjaImage({},{kind:'frame',mode:'exact',name:'frame_9',base64:bytes.toString('base64')},deps)
  assert.equal(report.ok,true)
  assert.equal(report.name,'frame_9.webp')
  assert.equal(report.publicCheck.ok,true)
  const mismatch=await writeMorkahjaImage({},{kind:'frame',mode:'exact',name:'frame_9',base64:bytes.toString('base64')},
    {...deps,run:async()=>({ok:true,name:'frame_9.webp',sha256:'0'.repeat(64),replaced:true})})
  assert.equal(mismatch.code,'IMAGE_WRITE_VERIFY_FAILED')
  const denied=await writeMorkahjaImage({},{kind:'frame',mode:'exact',name:'frame_9',base64:bytes.toString('base64')},
    {...deps,readConfig:async()=>({ok:false,code:'REMOTE_SCOPE_DENIED'})})
  assert.equal(denied.code,'REMOTE_SCOPE_DENIED')
})

test('the public check compares the downloaded bytes',async()=>{
  const bytes=webp('pic')
  const sha=createHash('sha256').update(bytes).digest('hex')
  const serve=body=>async url=>{
    assert.match(url,/^https:\/\/www\.babuni\.dev\/Morkahja\/game\/encounterimages\/a\.webp\?v=/)
    return new Response(body,{status:200})
  }
  assert.equal((await checkPublicImage('encounter','a.webp',sha,{fetchImpl:serve(bytes)})).ok,true)
  assert.equal((await checkPublicImage('encounter','a.webp',sha,{fetchImpl:serve(webp('old'))})).ok,false)
  const missing=await checkPublicImage('encounter','a.webp',sha,{fetchImpl:async()=>new Response('',{status:404})})
  assert.deepEqual({ok:missing.ok,status:missing.status},{ok:false,status:404})
})
