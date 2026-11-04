import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parsePlayerPage,PLAYER_PAGE_SIZE,READ_ONLY_FIELDS,classifyReadOnlyError} from '../local-service/morkahjaReadOnly.mjs'

test('page input is bounded, strictly typed and cannot add query options',()=>{
  assert.equal(parsePlayerPage({page:1}),1)
  assert.equal(parsePlayerPage({page:1000}),1000)
  for(const value of [null,{},[],{page:0},{page:1001},{page:-1},
    {page:1.2},{page:'1'},{page:true},{page:1,fields:['identityPublicKey']},
    {page:1,sort:'data'},{page:1,limit:100000}]) {
    assert.throws(()=>parsePlayerPage(value),/INVALID_PAGE/)
  }
  assert.equal(PLAYER_PAGE_SIZE,20)
  assert.deepEqual(READ_ONLY_FIELDS,['displayName','avatarCount','lastPlayedAt'])
})

test('read-only adapter contains no SQL mutations or legacy admin imports',()=>{
  const source=readFileSync('local-service/morkahjaReadOnly.mjs','utf8')
  assert.match(source,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(source,/ROLLBACK/)
  assert.match(source,/FROM babuni_admin_ro\\.overview/)
  assert.match(source,/FROM babuni_admin_ro\\.player_preview/)
  assert.doesNotMatch(source,/FROM (?:public\\.)?(?:players|avatars|sessions|game_events)\\b/i)
  assert.match(source,/DB_ROLE_RAW_READ_ACCESS/)
  assert.doesNotMatch(source,/\b(?:DELETE|INSERT|UPDATE|TRUNCATE|DROP|ALTER)\b/i)
  assert.doesNotMatch(source,/postgresAdmin\.ts/)
})

test('diagnostic categories expose no raw PostgreSQL error details',()=>{
  const sample={message:'secret=do-not-return-this',detail:'private-row-data'}
  const expected={
    '42501':'DB_READ_PERMISSION_DENIED',
    '42P01':'DB_READ_TABLE_MISSING',
    '42703':'DB_READ_COLUMN_MISSING',
    '42883':'DB_READ_SCHEMA_MISMATCH',
    '42804':'DB_READ_SCHEMA_MISMATCH',
    '22P02':'DB_READ_INVALID_DATA',
    '22003':'DB_READ_INVALID_DATA',
    '57014':'DB_READ_TIMEOUT',
    '28P01':'DB_READ_AUTH_FAILED',
    '08006':'DB_READ_CONNECTION_FAILED',
    'ECONNREFUSED':'DB_READ_CONNECTION_FAILED',
    'UNKNOWN':'REMOTE_READ_FAILED',
  }
  for(const [code,result] of Object.entries(expected)){
    const actual=classifyReadOnlyError({...sample,code})
    assert.equal(actual,result)
    assert.equal(actual.includes('secret'),false)
    assert.equal(actual.includes('private-row-data'),false)
  }
})
