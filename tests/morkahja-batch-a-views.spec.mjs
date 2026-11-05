import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import pg from 'pg'

// This test must never run against Morkahja or another real database.
const url=process.env.TEST_DATABASE_URL
if(!url)throw new Error('Disposable TEST_DATABASE_URL is required')
const target=new URL(url)
if(target.hostname!=='127.0.0.1' || target.pathname!=='/babuni_fixture' ||
    target.username!=='fixture') {
  throw new Error('Refusing non-fixture PostgreSQL environment')
}

test('Batch A aggregate SQL counts only approved ownership and enforces reader isolation', async()=>{
  const suffix=process.pid.toString(36)
  const dataSchema='batch_a_source_'+suffix
  const viewSchema='batch_a_views_'+suffix
  const owner='batch_a_owner_'+suffix
  const reader='batch_a_reader_'+suffix
  const client=new pg.Client({connectionString:url,connectionTimeoutMillis:4000})
  await client.connect()
  let roleSet=false
  try {
    await client.query('CREATE ROLE '+owner+' NOLOGIN')
    await client.query('CREATE ROLE '+reader+' NOLOGIN')
    await client.query('CREATE SCHEMA '+dataSchema)
    await client.query('CREATE SCHEMA '+viewSchema+' AUTHORIZATION '+owner)
    await client.query('CREATE TABLE '+dataSchema+
      '.players (id text PRIMARY KEY, data jsonb NOT NULL)')
    await client.query('CREATE TABLE '+dataSchema+
      '.player_achievements (player_id text, achievement_id text, rank integer NOT NULL)')
    await client.query('GRANT USAGE ON SCHEMA '+dataSchema+' TO '+owner)
    await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA '+dataSchema+' TO '+owner)
    await client.query('GRANT USAGE ON SCHEMA '+viewSchema+' TO '+reader)

    for(const [id,data] of [
      ['one',{unlockedExpansions:[0,1001,1001,1003],unlockedDiceIds:['a','b','b','c']}],
      ['two',{unlockedExpansions:[0,1003],unlockedDiceIds:['a','f']}],
      ['three',{unlockedExpansions:[0],unlockedDiceIds:['a']}],
      ['four',{}],
    ]) {
      await client.query('INSERT INTO '+dataSchema+'.players(id,data) VALUES ($1,$2)',[id,data])
    }
    for(const [id,achievement,rank] of [
      ['one','adventurer',1],['one','firestarter',3],['one','progress-only',0],
      ['two','adventurer',1],['three','progress-only',0],
    ]) {
      await client.query('INSERT INTO '+dataSchema+
        '.player_achievements(player_id,achievement_id,rank) VALUES($1,$2,$3)',
        [id,achievement,rank])
    }

    const original=readFileSync('scripts/morkahja-batch-a-aggregate-views.sql','utf8')
    const adapted=original
      .replaceAll('public.player_achievements',dataSchema+'.player_achievements')
      .replaceAll('public.players',dataSchema+'.players')
      .replaceAll('babuni_admin_ro.',viewSchema+'.')
      .replaceAll('morkahjadbadmin',owner)
      .replaceAll('babuni_admin_probe',reader)
    await client.query(adapted)
    assert.equal((await client.query(
      "SELECT pg_get_userbyid(c.relowner) AS owner FROM pg_class c "+
      "JOIN pg_namespace n ON n.oid=c.relnamespace "+
      "WHERE n.nspname=$1 AND c.relname='progression_ownership_totals'",
      [viewSchema])).rows[0].owner,owner)
    const permissions=(await client.query(
      'SELECT has_table_privilege($1,$2,$3) AS view_select,'+
      'has_table_privilege($1,$4,$3) AS raw_player_select,'+
      'has_table_privilege($1,$5,$3) AS raw_achievement_select,'+
      'has_table_privilege($1,$2,$6) AS view_update',
      [reader,viewSchema+'.progression_ownership_totals','SELECT',
        dataSchema+'.players',dataSchema+'.player_achievements','UPDATE']
    )).rows[0]
    assert.deepEqual(permissions,{
      view_select:true,raw_player_select:false,raw_achievement_select:false,view_update:false
    })

    await client.query('SET ROLE '+reader)
    roleSet=true
    const select=()=>client.query('SELECT * FROM '+viewSchema+'.progression_ownership_totals')
    const rows=(await select()).rows
    assert.equal(rows.length,1)
    assert.deepEqual(rows[0],{
      achievements_unlocked:'3',players_with_achievements:'2',
      dice_unlocks:'3',expansion_unlocks:'3',
      invalid_player_documents:'0',invalid_dice_shapes:'0',
      invalid_dice_entries:'0',invalid_expansion_shapes:'0',
      invalid_expansion_entries:'0',
    })
    await assert.rejects(
      ()=>client.query('SELECT id FROM '+dataSchema+'.players'),
      error=>error.code==='42501'
    )
    await client.query('RESET ROLE')
    roleSet=false

    // Unknown expansion/dice identifiers are not turned into a misleading zero.
    await client.query('INSERT INTO '+dataSchema+'.players(id,data) VALUES($1,$2)',
      ['invalid',{unlockedExpansions:['1001'],unlockedDiceIds:['unknown']}])
    await client.query('SET ROLE '+reader)
    roleSet=true
    const invalid=(await select()).rows[0]
    assert.equal(invalid.achievements_unlocked,'3')
    assert.equal(invalid.dice_unlocks,null)
    assert.equal(invalid.expansion_unlocks,null)
    assert.equal(invalid.invalid_dice_entries,'1')
    assert.equal(invalid.invalid_expansion_entries,'1')
    await client.query('RESET ROLE')
    roleSet=false
    await client.query('DELETE FROM '+dataSchema+".players WHERE id='invalid'")

    // Re-applying the reviewed DDL is idempotent and does not change counts.
    await client.query(adapted)
    await client.query('SET ROLE '+reader)
    roleSet=true
    assert.deepEqual((await select()).rows[0],rows[0])
  } finally {
    try {if(roleSet) await client.query('RESET ROLE')} catch {}
    try {await client.query('DROP SCHEMA IF EXISTS '+viewSchema+' CASCADE')} catch {}
    try {await client.query('DROP SCHEMA IF EXISTS '+dataSchema+' CASCADE')} catch {}
    try {await client.query('DROP ROLE IF EXISTS '+reader)} catch {}
    try {await client.query('DROP ROLE IF EXISTS '+owner)} catch {}
    await client.end()
  }
})
