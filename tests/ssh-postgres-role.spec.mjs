import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {startSshTunnel} from '../local-service/sshTunnel.mjs'
import { inspectReadOnlyDatabase } from '../local-service/sshPostgresProbe.mjs'

const url=process.env.TEST_DATABASE_URL
if(!url)throw new Error('Disposable TEST_DATABASE_URL is required')
const parsed=new URL(url)
if(parsed.hostname!=='127.0.0.1' || parsed.pathname!=='/babuni_fixture' ||
    parsed.username!=='fixture')throw new Error('Refusing non-fixture PostgreSQL environment')
const port=Number(parsed.port)||5432

test('read-only health transaction accepts fixture reader and rejects privileged role',async()=>{
  const admin=new pg.Client({connectionString:url,connectionTimeoutMillis:4000})
  await admin.connect()
  try {
    await admin.query("CREATE ROLE babuni_health_reader LOGIN PASSWORD 'synthetic-only-credential'")
    await admin.query("GRANT CONNECT ON DATABASE babuni_fixture TO babuni_health_reader")
    const reader=await inspectReadOnlyDatabase({
      dbUser:'babuni_health_reader',dbName:'babuni_fixture',
    },port,'synthetic-only-credential')
    assert.deepEqual(reader,{ok:true})
    // Simulated SSH command: real disposable PostgreSQL travels through a
    // private local Unix-domain socket, never through any real SSH server.
    const root=mkdtempSync(join(tmpdir(),'babuni-postgres-forward-'))
    const fakeSsh=join(root,'ssh')
    const previousPath=process.env.PATH
    let tunnel
    try {
      writeFileSync(fakeSsh,[
        '#!/usr/bin/env node',
        "import {createServer,connect} from 'node:net'",
        "const args=process.argv.slice(2)",
        "const forward=args[args.indexOf('-L')+1]",
        "const sep=forward.indexOf(':127.0.0.1:')",
        "if(sep<1)process.exit(2)",
        'const socketPath=forward.slice(0,sep)',
        'const dbPort=Number(forward.slice(sep+11))',
        'const server=createServer(client=>{',
        "const remote=connect({host:'127.0.0.1',port:dbPort})",
        "client.on('error',()=>remote.destroy())",
        "remote.on('error',()=>client.destroy())",
        'client.pipe(remote).pipe(client)',
        '})',
        'server.listen(socketPath)',
        "process.on('SIGTERM',()=>server.close(()=>process.exit(0)))",
        '',
      ].join('\n'),{mode:0o700})
      chmodSync(fakeSsh,0o700)
      process.env.PATH=root+':'+previousPath
      tunnel=await startSshTunnel({
        host:'fixture.example.invalid',sshPort:22,sshUser:'fixture',
        sshIdentityFile:'/tmp/disposable-ssh-fixture',dbPort:port,
      })
      const overSocket=await inspectReadOnlyDatabase({
        dbUser:'babuni_health_reader',dbName:'babuni_fixture',
      },tunnel.socketDir,'synthetic-only-credential')
      assert.deepEqual(overSocket,{ok:true})
    } finally {
      await tunnel?.stop()
      process.env.PATH=previousPath
      rmSync(root,{recursive:true,force:true})
    }
    const privileged=await inspectReadOnlyDatabase({
      dbUser:'fixture',dbName:'babuni_fixture',
    },port,decodeURIComponent(parsed.password))
    assert.deepEqual(privileged,{ok:false,code:'DB_ROLE_NOT_READ_ONLY'})
    assert.equal((await admin.query('SELECT rolcanlogin FROM pg_roles WHERE rolname=$1',
      ['babuni_health_reader'])).rows[0].rolcanlogin,true)
  } finally {
    try { await admin.query('DROP ROLE IF EXISTS babuni_health_reader') }catch{}
    await admin.end()
  }
})
