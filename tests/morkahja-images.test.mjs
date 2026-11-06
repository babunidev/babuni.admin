import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {readFileSync} from 'node:fs'
import {imageRequest,fetchMorkahjaImage,runImageSsh} from '../local-service/morkahjaImages.mjs'

const profile={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  projectId:'morkahja',kind:'postgres-ssh-moderation',target:'example.invalid'}

test('image request only permits fixed public WebP names and kinds',()=>{
  for(const kind of ['encounter','solution','expansion','frame','portrait'])
    assert.deepEqual(imageRequest({kind,name:'im_header_expansion_1.webp'}),{
      kind,name:'im_header_expansion_1.webp'})
  for(const invalid of [
    {kind:'encounter',name:'../.ssh/id_rsa'},
    {kind:'encounter',name:'../../etc/passwd.webp'},
    {kind:'encounter',name:'abc.png'},
    {kind:'config',name:'a.webp'},
    {kind:'encounter',name:'foo.webp',path:'/etc/passwd'},
    {kind:'encounter',name:'bad/name.webp'},
    {kind:'encounter',name:'hidden.webp\n'},
  ])assert.throws(()=>imageRequest(invalid),/INVALID_IMAGE_REQUEST/)
})

test('image retrieval authorizes same administrator SSH configuration, not extra credentials',async()=>{
  let calls=0
  const response=await fetchMorkahjaImage(profile,
    {kind:'encounter',name:'nerevals_sanctuary.webp'},{
      readConfig:async selected=>{
        assert.equal(selected,profile)
        return {ok:true,config:{host:'example.invalid'}}
      },
      run:async (config,request)=>{
        calls++
        assert.equal(config.host,'example.invalid')
        assert.equal(request.name,'nerevals_sanctuary.webp')
        return {ok:true,base64:'AA==',contentType:'image/webp'}
      },
    })
  assert.equal(response.ok,true)
  assert.equal(calls,1)
})

test('invalid requests never trigger configuration or SSH activity',async()=>{
  let attempted=false
  const result=await fetchMorkahjaImage(profile,{kind:'encounter',name:'../secret.webp'},{
    readConfig:()=>{attempted=true},
  })
  assert.deepEqual(result,{ok:false,code:'INVALID_IMAGE_REQUEST'})
  assert.equal(attempted,false)
})

test('remote image process receives fixed Python worker and restricted tokens only',async()=>{
  let command='',args
  const webp=Buffer.concat([
    Buffer.from('RIFF'),Buffer.from([0,0,0,0]),Buffer.from('WEBP'),
    Buffer.from([1,2,3]),
  ])
  const start=(bin,argv,options)=>{
    assert.equal(bin,'ssh')
    assert.equal(options.shell,false)
    args=argv
    const child=new EventEmitter()
    child.stdout=new EventEmitter()
    child.stderr=new EventEmitter()
    child.kill=()=>{}
    child.stdin={on:()=>{},end:value=>{
      command=value
      queueMicrotask(()=>{
        child.stdout.emit('data',Buffer.from(JSON.stringify({
          ok:true,base64:webp.toString('base64'),
        })))
        child.emit('close',0,null)
      })
    }}
    return child
  }
  const result=await runImageSsh({
    host:'example.invalid',sshPort:22,sshIdentityFile:'/tmp/identity',sshUser:'babuni',
  },{kind:'encounter',name:'nerevals_sanctuary.webp'},{start})
  assert.equal(result.ok,true)
  assert.ok(args.includes('StrictHostKeyChecking=yes'))
  assert.ok(args.includes('BatchMode=yes'))
  assert.match(command,/REQUEST_JSON=/)
  assert.match(command,/os\.O_NOFOLLOW/)
  assert.match(command,/\/var\/www\/morkahja/)
  assert.doesNotMatch(command,/eval\(/)
})

test('local image endpoint stays behind session-protected POST and scoped content capability',()=>{
  const server=readFileSync('local-service/server.mjs','utf8')
  assert.match(server,/action==='content-image'/)
  assert.match(server,/hasCapability\(profile,'ssh:content'\)/)
  assert.match(server,/fetchMorkahjaImage\(profile,request\)/)
  assert.match(server,/req\.headers\['x-babuni-service-key'\]/)
})
