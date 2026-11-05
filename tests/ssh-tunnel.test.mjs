import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,chmodSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {buildSshTunnelArgs,startSshTunnel,stopAllSshTunnels,classifySshExitDiagnostic} from '../local-service/sshTunnel.mjs'

test('SSH child pins hosts, creates private Unix forward and inherits no service tokens',async()=>{
  const root=mkdtempSync(join(tmpdir(),'babuni-ssh-command-'))
  const binary=join(root,'ssh')
  const audit=join(root,'argv.json')
  const originalPath=process.env.PATH
  const originalToken=process.env.BABUNI_LOCAL_SERVICE_TOKEN
  let tunnel
  try{
    // The fixture substitutes a local-only Unix listener for the ssh command.
    writeFileSync(binary,[
      '#!/usr/bin/env node',
      "import {createServer} from 'node:net'",
      "import {writeFileSync} from 'node:fs'",
      'const args=process.argv.slice(2)',
      "writeFileSync(new URL('./argv.json',import.meta.url),JSON.stringify({args,serviceToken:process.env.BABUNI_LOCAL_SERVICE_TOKEN||null}))",
      "const forward=args[args.indexOf('-L')+1]",
      "const index=forward.indexOf(':127.0.0.1:')",
      "if(index<1)process.exit(2)",
      'const socketPath=forward.slice(0,index)',
      "if(!socketPath.endsWith('/.s.PGSQL.5432'))process.exit(2)",
      'const server=createServer(socket=>socket.destroy())',
      'server.listen(socketPath)',
      "process.on('SIGTERM',()=>server.close(()=>process.exit(0)))",
      '',
    ].join('\n'),{mode:0o700})
    chmodSync(binary,0o700)
    process.env.PATH=root+':'+originalPath
    process.env.BABUNI_LOCAL_SERVICE_TOKEN='synthetic-must-not-leak'
    tunnel=await startSshTunnel({
      host:'morkahja.example.invalid',sshPort:2222,sshUser:'read_only',
      sshIdentityFile:'/tmp/fixture-only-key',dbPort:5432,
    })
    assert.ok(tunnel.socketDir.startsWith('/'))
    assert.ok(existsSync(tunnel.socketDir))
    const auditResult=JSON.parse(readFileSync(audit,'utf8'))
    const args=auditResult.args
    assert.equal(auditResult.serviceToken,null)
    assert.deepEqual(args.slice(0,4),['-F','/dev/null','-N','-T'])
    assert.ok(args.includes('StrictHostKeyChecking=yes'))
    assert.ok(args.includes('BatchMode=yes'))
    assert.ok(args.includes('GlobalKnownHostsFile=/dev/null'))
    assert.ok(args.includes('ForwardAgent=no'))
    assert.ok(args.includes('PreferredAuthentications=publickey'))
    assert.ok(args.includes('ProxyCommand=none'))
    assert.ok(args.includes(join(tunnel.socketDir,'.s.PGSQL.5432')+':127.0.0.1:5432'))
    assert.equal(args.at(-1),'morkahja.example.invalid')
    assert.equal(args.some(v=>/^(yes|accept-new|no)$/.test(v)),false)
    await tunnel.stop()
    assert.equal(existsSync(tunnel.socketDir),false)
    tunnel=null
  }finally{
    await tunnel?.stop()
    await stopAllSshTunnels()
    if(originalPath===undefined)delete process.env.PATH
    else process.env.PATH=originalPath
    if(originalToken===undefined)delete process.env.BABUNI_LOCAL_SERVICE_TOKEN
    else process.env.BABUNI_LOCAL_SERVICE_TOKEN=originalToken
    rmSync(root,{recursive:true,force:true})
  }
})

// -G evaluates configuration and exits without contacting the fixture host.
test('production tunnel arguments parse in real OpenSSH with terminal allocation disabled',()=>{
  const args=buildSshTunnelArgs({
    host:'morkahja.example.invalid',sshPort:2222,sshUser:'read_only',
    sshIdentityFile:'/tmp/fixture-only-key',dbPort:5432,
  },'/tmp/fixture-only-socket')
  const parsed=spawnSync('ssh',['-G',...args],{encoding:'utf8',timeout:5000})
  assert.ifError(parsed.error)
  assert.equal(parsed.status,0,parsed.stderr)
  assert.match(parsed.stdout,/^requesttty false$/m)
})


test('SSH failure categories never expose raw stderr or identity paths',()=>{
  const cases=[
    ['Permission denied (publickey). Identity /home/private/key', 'SSH_AUTH_REJECTED'],
    ['Host key verification failed. remote: private.example', 'SSH_HOST_KEY_REJECTED'],
    ['WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!', 'SSH_HOST_KEY_REJECTED'],
    ['Warning: Identity file /secret/key not accessible: No such file', 'SSH_IDENTITY_UNAVAILABLE'],
    ['Load key "/private/id_ed25519": invalid format', 'SSH_IDENTITY_UNAVAILABLE'],
    ['channel 0: open failed: administratively prohibited', 'SSH_FORWARD_DENIED'],
    ['Bad configuration option: bogus. private', 'SSH_CLIENT_CONFIG_INVALID'],
    ['ssh: connect to host private.example port 22: Connection refused', 'SSH_HOST_UNREACHABLE'],
    ['unknown private path and key', 'SSH_SESSION_FAILED'],
  ]
  for(const [source,expected] of cases){
    const code=classifySshExitDiagnostic(source)
    assert.equal(code,expected)
    assert.equal(code.includes('private'),false)
    assert.equal(code.includes('/secret'),false)
  }
})

test('early SSH exit returns only a sanitized category and closes its temp socket directory',async()=>{
  const root=mkdtempSync(join(tmpdir(),'babuni-ssh-exit-'))
  const binary=join(root,'ssh')
  const original=process.env.PATH
  try {
    writeFileSync(binary,[
      '#!/bin/sh',
      "printf '%s\\n' 'Permission denied (publickey). secret=/home/operator/.ssh/id_secret' >&2",
      'exit 255',
      '',
    ].join('\n'),{mode:0o700})
    process.env.PATH=root+':'+(original??'')
    await assert.rejects(
      startSshTunnel({host:'fixture.invalid',sshPort:22,sshUser:'fixture',
        sshIdentityFile:'/tmp/fixture-key',dbPort:5432}),
      error=>error.message==='SSH_AUTH_REJECTED' &&
        !JSON.stringify(error).includes('id_secret')
    )
    await stopAllSshTunnels()
  }finally{
    if(original===undefined)delete process.env.PATH
    else process.env.PATH=original
    rmSync(root,{recursive:true,force:true})
  }
})
