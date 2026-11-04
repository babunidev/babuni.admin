import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parsePlayerPage,PLAYER_PAGE_SIZE,READ_ONLY_FIELDS} from '../local-service/morkahjaReadOnly.mjs'

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
  assert.doesNotMatch(source,/\b(?:DELETE|INSERT|UPDATE|TRUNCATE|DROP|ALTER)\b/i)
  assert.doesNotMatch(source,/postgresAdmin\.ts/)
})
