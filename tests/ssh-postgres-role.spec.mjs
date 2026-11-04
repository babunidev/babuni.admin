import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
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
