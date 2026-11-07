import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {hasCapability} from '../vite/connectionAdapters.ts'

const source=path=>readFileSync(path,'utf8')

test('one Morkahja administrator profile has all existing overview moderation and content capabilities',()=>{
  const owner={projectId:'morkahja',kind:'postgres-ssh-moderation'}
  for(const capability of ['ssh:read','ssh:moderation','ssh:content'])
    assert.equal(hasCapability(owner,capability),true)
  const legacy={...owner,kind:'postgres-ssh'}
  assert.equal(hasCapability(legacy,'ssh:content'),false)
  assert.equal(hasCapability(legacy,'ssh:moderation'),false)
})

test('Overview and Content share Moderation profile key, with legacy Overview compatibility',()=>{
  const admin=source('src/features/morkahja/services/adminApi.ts')
  const content=source('src/features/morkahja/services/contentApi.ts')
  const overview=source('src/features/morkahja/pages/ReadOnlyDashboardPage.tsx')
  assert.match(admin,/export const MODERATION_PROFILE_KEY/)
  assert.match(content,/export const CONTENT_PROFILE_KEY = MODERATION_PROFILE_KEY/)
  assert.match(overview,/activateMorkahjaConnection/)
  assert.match(overview,/const LEGACY_PROFILE_KEY/)
})

test('admin view snapshots remain in a read-only SQL transaction',()=>{
  const read=source('local-service/morkahjaReadOnly.mjs')
  assert.match(read,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(read,/verifyModerationRole\(client,config,true\)/)
  assert.match(read,/mode==='restricted'/)
  assert.doesNotMatch(read,/client\.query\(['"](?:UPDATE|INSERT|DELETE|TRUNCATE) /)
})

test('one admin SSH identity serves content without a second config or privilege toggle',()=>{
  const config=source('local-service/morkahjaContentConfig.mjs')
  const runner=source('local-service/sshPostgresProbe.mjs')
  const moderation=source('local-service/morkahjaModerationRunner.mjs')
  assert.match(config,/import \{readMorkahjaModerationConfig\} from '\.\/morkahjaModerationConfig\.mjs'/)
  assert.match(config,/return readMorkahjaModerationConfig\(profile,env\)/)
  assert.match(runner,/readMorkahjaModerationConfig/)
  assert.doesNotMatch(moderation,/BABUNI_MORKAHJA_MODERATION_WRITES/)
})

test('Connection is the only user-facing profile manager',()=>{
  const connection=source('src/pages/ConnectionsPage.tsx')
  const players=source('src/features/morkahja/pages/PlayersPage.tsx')
  const content=source('src/features/morkahja/pages/ContentPage.tsx')
  const overview=source('src/features/morkahja/pages/ReadOnlyDashboardPage.tsx')
  assert.match(connection,/PageHeader title="Connection"/)
  assert.doesNotMatch(connection,/Previous and unused profiles/)
  assert.match(connection,/Remove unused Morkahja server profile/)
  assert.match(connection,/Babuni Dev administrator/)
  assert.match(connection,/Test database read/)
  assert.doesNotMatch(players,/moderation-profile|Select your Morkahja administrator connection/)
  assert.doesNotMatch(content,/id="content-profile"/)
  assert.doesNotMatch(overview,/id="readonly-profile"/)
})
