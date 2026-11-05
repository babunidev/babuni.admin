import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

test('Batch A SQL is an explicitly operator-run owner-scoped aggregate view',()=>{
  const sql=readFileSync('scripts/morkahja-batch-a-aggregate-views.sql','utf8')
  assert.match(sql,/REVIEWED SOURCE ARTIFACT, NOT AN AUTOMATIC MIGRATION/)
  assert.match(sql,/SET LOCAL ROLE morkahjadbadmin/)
  assert.match(sql,/CREATE OR REPLACE VIEW babuni_admin_ro\.progression_ownership_totals/)
  assert.match(sql,/security_barrier\s*=\s*true/)
  assert.match(sql,/security_invoker\s*=\s*false/)
  assert.match(sql,/FROM public\.player_achievements/)
  assert.match(sql,/FROM public\.players/)
  assert.match(sql,/WHERE rank >= 1/)
  assert.match(sql,/GRANT SELECT ON babuni_admin_ro\.progression_ownership_totals TO babuni_admin_probe;/)
  assert.doesNotMatch(sql,/GRANT\s+(?:SELECT|ALL)\s+ON\s+public\./i)
  assert.doesNotMatch(sql,/DROP\s+(?:SCHEMA|TABLE|VIEW|ROLE)/i)
  assert.doesNotMatch(sql,/DELETE\s+FROM|UPDATE\s+public\.|INSERT\s+INTO/i)
  assert.match(sql,/COMMIT;/)
})
