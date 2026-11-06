import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {createMorkahjaImageCache} from '../local-service/morkahjaImageCache.mjs'

const profile={id:'00000000-0000-4000-8000-000000000001',
  projectId:'morkahja',kind:'postgres-ssh-moderation',target:'test.example.invalid'}
const config={host:profile.target,sshPort:22,sshUser:'babuni',
  sshIdentityFile:'/tmp/mock-ssh-identity'}
const bytes=Buffer.from('RIFF\0\0\0\0WEBPcache-payload')
const name='nerevals_sanctuary.webp'

function fakeRemote() {
  let metadata={size:bytes.length,mtimeNs:'100'}
  let contents=bytes
  let calls=0
  function spawnSsh(command,args,options) {
    assert.equal(command,'ssh')
    assert.equal(options.shell,false)
    assert.ok(args.includes('StrictHostKeyChecking=yes'))
    calls++
    const child=new EventEmitter()
    child.stdout=new PassThrough()
    child.stderr=new PassThrough()
    child.kill=()=>{
      child.stdout.end()
      queueMicrotask(()=>child.emit('close',137,'SIGKILL'))
    }
    child.stdin={on:()=>{},end(input)=>{
      queueMicrotask(()=>{
        const prefix=input.split('\n',1)[0]
        assert.ok(prefix.startsWith('CACHED_JSON='))
        const manifest=JSON.parse(JSON.parse(prefix.slice('CACHED_JSON='.length)))
        const old=manifest['encounter/'+name]
        const record=old && JSON.stringify(old)===JSON.stringify(metadata)
          ? {type:'keep',kind:'encounter',name,meta:metadata}
          : {type:'file',kind:'encounter',name,meta:metadata,
            base64:contents.toString('base64')}
        child.stdout.write(JSON.stringify(record)+'\n')
        child.stdout.write(JSON.stringify({
          type:'complete',count:1,totalBytes:contents.length,
        })+'\n')
        child.stdout.end()
        queueMicrotask(()=>child.emit('close',0,null))
      })
    }}
    return child
  }
  return {
    spawnSsh,
    count:()=>calls,
    update(nextBytes,nextMtime){
      metadata={size:nextBytes.length,mtimeNs:nextMtime}
      contents=nextBytes
    },
  }
}

async function untilReady(cache) {
  for(let attempt=0;attempt<200;attempt++){
    const result=cache.status(profile)
    if(result.phase!=='syncing')return result
    await new Promise(resolve=>setTimeout(resolve,20))
  }
  throw new Error('Test cache sync timed out')
}

test('workspace preloads all images, persists them, skips unchanged and updates changed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'babuni-image-cache-test-'))
  try {
    const remote=fakeRemote()
    const options={
      root,approve:async()=>({ok:true,config}),
      startSsh:remote.spawnSsh,readWorker:async()=>'\n',
    }
    const first=createMorkahjaImageCache(options)
    assert.equal(first.ensureSync(profile).phase,'syncing')
    const started=await first.readCached(profile,{kind:'encounter',name})
    assert.equal(started.code,'IMAGE_CACHE_PENDING')
    const ready=await untilReady(first)
    assert.equal(ready.phase,'ready',ready.error||'')
    assert.equal(ready.cached,1)
    assert.equal(ready.downloaded,1)
    const found=await first.readCached(profile,{kind:'encounter',name})
    assert.equal(found.ok,true)
    assert.equal(found.base64,bytes.toString('base64'))
    await first.stop()

    // A second process sees the persistent disk file without any SSH call.
    const restart=createMorkahjaImageCache(options)
    const offline=await restart.readCached(profile,{kind:'encounter',name})
    assert.equal(offline.base64,bytes.toString('base64'))
    assert.equal(remote.count(),1)

    restart.ensureSync(profile)
    const unchanged=await untilReady(restart)
    assert.equal(unchanged.phase,'ready')
    assert.equal(unchanged.downloaded,0)
    assert.equal(remote.count(),2)
    const updated=Buffer.from('RIFF\0\0\0\0WEBPnew-cache-payload')
    remote.update(updated,'200')
    // New workspace process runs the next metadata check immediately.
    const third=createMorkahjaImageCache(options)
    third.ensureSync(profile)
    const changed=await untilReady(third)
    assert.equal(changed.phase,'ready')
    assert.equal(changed.downloaded,1)
    assert.equal((await third.readCached(profile,{kind:'encounter',name})).base64,
      updated.toString('base64'))
    await restart.stop()
    await third.stop()
  }finally {await rm(root,{recursive:true,force:true})}
})

test('failed SSH sync leaves previously cached images accessible on disk',async()=>{
  const root=await mkdtemp(join(tmpdir(),'babuni-image-cache-offline-'))
  try {
    const remote=fakeRemote()
    const cache=createMorkahjaImageCache({
      root,approve:async()=>({ok:true,config}),
      startSsh:remote.spawnSsh,readWorker:async()=>'\n',
    })
    cache.ensureSync(profile)
    assert.equal((await untilReady(cache)).phase,'ready')
    const offline=createMorkahjaImageCache({
      root,approve:async()=>({ok:false,code:'SSH_HOST_UNAVAILABLE'}),
    })
    offline.ensureSync(profile)
    const failed=await untilReady(offline)
    assert.equal(failed.phase,'failed')
    assert.equal(failed.error,'SSH_HOST_UNAVAILABLE')
    assert.equal((await offline.readCached(profile,{kind:'encounter',name})).ok,true)
    await cache.stop()
    await offline.stop()
  }finally {await rm(root,{recursive:true,force:true})}
})

test('cache path traversal and unknown image folders never read local files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'babuni-image-cache-path-'))
  try {
    const cache=createMorkahjaImageCache({root})
    for(const bad of [
      {kind:'encounter',name:'../private.webp'},
      {kind:'portrait',name:'a/b.webp'},
      {kind:'settings',name:'settings.webp'},
    ])assert.equal((await cache.readCached(profile,bad)).code,'INVALID_IMAGE_REQUEST')
  }finally {await rm(root,{recursive:true,force:true})}
})
