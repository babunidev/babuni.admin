import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,chmodSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startSshTunnel,stopAllSshTunnels} from '../local-service/sshTunnel.mjs'

test('outbound SSH child uses strict pinning and a loopback-only ephemeral forward',async()=>{
  const root=mkdtempSync(join(tmpdir(),'babuni-ssh-command-'))
  const binary=join(root,'ssh')
  const audit=join(root,'argv.json')
  const original=process.env.PATH
  let tunnel
  try{
    // This fixture replaces ssh with a local-only listener. It cannot contact a VPS.
    writeFileSync(binary,[
      '#!/usr/bin/env node',
      "import {createServer} from 'node:net'",
      "import {writeFileSync} from 'node:fs'",
      'const args=process.argv.slice(2)',
      "writeFileSync(new URL('./argv.json',import.meta.url),JSON.stringify(args))",
      "const forward=args[args.indexOf('-L')+1]",
      "const match=/^127\\.0\\.0\\.1:(\\d+):127\\.0\\.0\\.1:(\\d+)$/.exec(forward)",
      'if(!match)process.exit(2)',
      'const server=createServer(socket=>socket.destroy())',
      "server.listen(Number(match[1]),'127.0.0.1')",
      "process.on('SIGTERM',()=>server.close(()=>process.exit(0)))",
      '',
    ].join('\n'),{mode:0o700})
    chmodSync(binary,0o700)
    process.env.PATH=root+':'+original
    tunnel=await startSshTunnel({
      host:'morkahja.example.invalid',sshPort:2222,sshUser:'read_only',
      sshIdentityFile:'/tmp/fixture-only-key',dbPort:5432,
    })
    assert.ok(tunnel.port>1024)
    const args=JSON.parse(readFileSync(audit,'utf8'))
    assert.deepEqual(args.slice(0,4),['-F','/dev/null','-N','-T'])
    assert.ok(args.includes('StrictHostKeyChecking=yes'))
    assert.ok(args.includes('BatchMode=yes'))
    assert.ok(args.includes('GlobalKnownHostsFile=/dev/null'))
    assert.ok(args.includes('ForwardAgent=no'))
    assert.ok(args.includes('ProxyCommand=none'))
    assert.ok(args.includes('127.0.0.1:'+tunnel.port+':127.0.0.1:5432'))
    assert.equal(args.at(-1),'morkahja.example.invalid')
    assert.equal(args.some(v=>/^(yes|accept-new|no)$/.test(v)),false)
  }finally{
    await tunnel?.stop()
    stopAllSshTunnels()
    if(original===undefined)delete process.env.PATH
    else process.env.PATH=original
    rmSync(root,{recursive:true,force:true})
  }
})
