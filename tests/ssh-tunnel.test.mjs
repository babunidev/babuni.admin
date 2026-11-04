import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,writeFileSync,chmodSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startSshTunnel,stopAllSshTunnels} from '../local-service/sshTunnel.mjs'

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
