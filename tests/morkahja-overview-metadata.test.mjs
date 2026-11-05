import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Morkahja metric discovery script is metadata-only and read-only',()=>{
  const sql=readFileSync('scripts/morkahja-overview-metadata.sql','utf8')
  assert.match(sql,/BEGIN READ ONLY;/)
  assert.match(sql,/ROLLBACK;/)
  assert.match(sql,/SET LOCAL statement_timeout/)
  assert.match(sql,/SET LOCAL lock_timeout/)
  assert.match(sql,/pg_catalog\.pg_class/)
  assert.match(sql,/information_schema\.columns/)
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)\s+/i)
  assert.doesNotMatch(sql,/SELECT\s+\*/i)
  assert.doesNotMatch(sql,/SELECT\s+data\b/i)
  assert.doesNotMatch(sql,/FROM\s+public\.(?:players|purchases|sessions|player_presence)\b/i)
})
