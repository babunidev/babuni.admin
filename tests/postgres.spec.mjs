import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import pg from 'pg'
import {queryMorkahjaReadOnly} from '../local-service/morkahjaReadOnly.mjs'
import { createServer } from 'vite'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl || !/127\.0\.0\.1|localhost/.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must explicitly point to a disposable localhost PostgreSQL instance')
}
let vite
let pool
let api
const now = Date.now()

before(async () => {
  pool = new pg.Pool({ connectionString: databaseUrl, max: 3 })
  // Only the dedicated CI test database may be used here.
  assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db, 'babuni_fixture')
  await pool.query(`DROP TABLE IF EXISTS active_encounters, inventories, progressions,
    player_achievements, game_events, avatars, sessions, players CASCADE`)
  await pool.query(`
    CREATE TABLE players (id text PRIMARY KEY, data jsonb NOT NULL);
    CREATE TABLE sessions (id text PRIMARY KEY, player_id text NOT NULL, data jsonb NOT NULL);
    CREATE TABLE avatars (id text PRIMARY KEY, player_id text NOT NULL, data jsonb NOT NULL);
    CREATE TABLE game_events (event_id text PRIMARY KEY, timestamp bigint, player_id text,
      avatar_id text, type text, importance text, payload jsonb, visibility text);
    CREATE TABLE player_achievements (player_id text, achievement_id text, rank int,
      progress int, unlocked_at text, updated_at text);
    CREATE TABLE progressions (id text, player_id text, avatar_id text, data jsonb);
    CREATE TABLE inventories (id text, player_id text, avatar_id text, data jsonb);
    CREATE TABLE active_encounters (id text, player_id text, avatar_id text, data jsonb);
  `)
  const data = { playerName: 'Fixture Player', activeSessionId: 'session-a',
    activeSessionExpiresAt: now + 180000, activeAvatarId: 'avatar-a',
    createdAt: now - 1000, lastPlayedAt: now,
    moderation: { banned: false, timeoutUntil: null } }
  await pool.query('INSERT INTO players(id,data) VALUES ($1,$2)', ['fixture-a', data])
  await pool.query('INSERT INTO sessions(id,player_id,data) VALUES ($1,$2,$3)',
    ['session-a','fixture-a', { expiresAt: now + 180000 }])
  await pool.query('INSERT INTO avatars(id,player_id,data) VALUES ($1,$2,$3)',
    ['avatar-a','fixture-a',{name:'Fixture Avatar',level:3,race:'Human',role:'Warrior'}])
  await pool.query('INSERT INTO game_events(event_id,timestamp,player_id,avatar_id,type,importance,payload,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    ['event-a', String(now), 'fixture-a', 'avatar-a', 'encounter_completed','normal',
      { encounterTitle:'Fixture Encounter' }, 'global'])
  vite = await createServer({ configFile:false, server:{ middlewareMode:true }, logLevel:'error' })
  api = await vite.ssrLoadModule('/vite/postgresAdmin.ts')
})
after(async () => {
  await vite?.close()
  await pool?.end()
})

test('PostgreSQL queries inspect player, avatar, live session, dashboard and events', async () => {
  const players = await api.listPlayersFromPostgres(databaseUrl)
  assert.equal(players.length,1)
  assert.equal(players[0].status,'online')
  const details = await api.getPlayerDetailFromPostgres(databaseUrl,'fixture-a')
  assert.equal(details.playerId,'fixture-a')
  assert.equal(details.avatars[0].name,'Fixture Avatar')
  assert.equal(details.recentEncounters.length,1)
  assert.equal((await api.getDashboardFromPostgres(databaseUrl)).onlinePlayers,1)
  assert.equal((await api.listActivityFromPostgres(databaseUrl)).length,1)
})

test('timeout atomically updates player and deletes all sessions', async () => {
  const result = await api.timeoutPlayerInPostgres(databaseUrl,'fixture-a',15,'fixture')
  assert.equal(result.ok,true)
  const row = (await pool.query('SELECT data FROM players WHERE id=$1',['fixture-a'])).rows[0].data
  assert.equal(row.activeSessionId,null)
  assert.equal(row.moderation.banned,false)
  assert.ok(row.moderation.timeoutUntil > Date.now())
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,0)
})

test('failed session deletion rolls back player moderation update', async () => {
  await pool.query('UPDATE players SET data=jsonb_set(data, \'{activeSessionId}\', \'"session-b"\') WHERE id=$1',['fixture-a'])
  await pool.query('INSERT INTO sessions(id,player_id,data) VALUES($1,$2,$3)',
    ['session-b','fixture-a',{expiresAt:now+360000}])
  await pool.query(`CREATE FUNCTION reject_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'injected session deletion failure'; END;
    $$`)
  await pool.query('CREATE TRIGGER session_delete_failure BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session_delete()')
  const beforePlayer = (await pool.query('SELECT data FROM players WHERE id=$1',['fixture-a'])).rows[0].data
  try {
    await assert.rejects(()=>api.banPlayerInPostgres(databaseUrl,'fixture-a','must rollback'),
      /injected session deletion failure/)
    const afterPlayer = (await pool.query('SELECT data FROM players WHERE id=$1',['fixture-a'])).rows[0].data
    assert.deepEqual(afterPlayer,beforePlayer)
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,1)
  } finally {
    await pool.query('DROP TRIGGER session_delete_failure ON sessions')
    await pool.query('DROP FUNCTION reject_session_delete()')
  }
})

test('ban and unban SQL operations commit and missing players never succeed', async () => {
  assert.equal((await api.banPlayerInPostgres(databaseUrl,'missing')).ok,false)
  const ban = await api.banPlayerInPostgres(databaseUrl,'fixture-a','test ban')
  assert.equal(ban.ok,true)
  let state=(await pool.query('SELECT data FROM players WHERE id=$1',['fixture-a'])).rows[0].data
  assert.equal(state.moderation.banned,true)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,0)
  const unban=await api.unbanPlayerInPostgres(databaseUrl,'fixture-a')
  assert.equal(unban.ok,true)
  state=(await pool.query('SELECT data FROM players WHERE id=$1',['fixture-a'])).rows[0].data
  assert.equal(state.moderation.banned,false)
})


test('dedicated read-only dashboard returns bounded data without session cleanup',async()=>{
  const role='babuni_data_preview_reader'
  const password='synthetic-read-only-preview'
  // Disposable fixture views have the same columns and permission boundary
  // as the owner-created live Morkahja views.
  await pool.query('DROP SCHEMA IF EXISTS babuni_admin_ro CASCADE')
  await pool.query('CREATE SCHEMA babuni_admin_ro')
  await pool.query(
    "CREATE VIEW babuni_admin_ro.overview WITH (security_barrier = true) AS SELECT "+
    "(SELECT COUNT(*) FROM public.players) AS players, "+
    "(SELECT COUNT(*) FROM public.avatars) AS avatars, "+
    "(SELECT COUNT(*) FROM public.sessions s JOIN public.players p ON p.id=s.player_id "+
    "WHERE p.data->>'activeSessionId'=s.id AND "+
    "(s.data->>'expiresAt')::bigint > (EXTRACT(EPOCH FROM now())*1000)::bigint) AS active_sessions, "+
    "(SELECT COUNT(*) FROM public.game_events) AS events_last_24h"
  )
  await pool.query(
    "CREATE VIEW babuni_admin_ro.player_preview WITH (security_barrier = true) AS SELECT "+
    "ROW_NUMBER() OVER (ORDER BY (p.data->>'lastPlayedAt')::bigint DESC NULLS LAST, p.id) AS position, "+
    "LEFT(COALESCE(NULLIF(p.data->>'playerName',''),'Unnamed player'),80) AS display_name, "+
    "(SELECT COUNT(*) FROM public.avatars a WHERE a.player_id=p.id) AS avatar_count, "+
    "(p.data->>'lastPlayedAt')::bigint AS last_played_at FROM public.players p"
  )
  await pool.query("CREATE ROLE babuni_data_preview_reader LOGIN PASSWORD 'synthetic-read-only-preview'")
  try {
    await pool.query('GRANT USAGE ON SCHEMA babuni_admin_ro TO '+role)
    // An otherwise safe, login-capable reader without view SELECT grants passes
    // the metadata health check but must receive a denied-read result.
    const noSelect=await queryMorkahjaReadOnly({
      dbUser:role,dbName:'babuni_fixture',
    },5432,password,'overview')
    assert.deepEqual(noSelect,{ok:false,code:'DB_READ_PERMISSION_DENIED'})
    await pool.query('GRANT SELECT ON babuni_admin_ro.overview, babuni_admin_ro.player_preview TO '+role)
    const privileges=(await pool.query([
      "SELECT has_table_privilege($1,'public.players','SELECT') AS players,",
      " has_table_privilege($1,'public.avatars','SELECT') AS avatars,",
      " has_table_privilege($1,'public.sessions','SELECT') AS sessions,",
      " has_table_privilege($1,'public.game_events','SELECT') AS events",
    ].join(' '),[role])).rows[0]
    assert.deepEqual(privileges,{players:false,avatars:false,sessions:false,events:false})
    // Ensure a mistakenly granted sensitive-table SELECT is rejected.
    await pool.query('GRANT SELECT ON public.sessions TO '+role)
    const overprivileged=await queryMorkahjaReadOnly({
      dbUser:role,dbName:'babuni_fixture',
    },5432,password,'overview')
    assert.deepEqual(overprivileged,{ok:false,code:'DB_ROLE_RAW_READ_ACCESS'})
    await pool.query('REVOKE SELECT ON public.sessions FROM '+role)
    // Column-specific SELECT can also expose session data; deny it as well.
    await pool.query('GRANT SELECT (data) ON public.sessions TO '+role)
    const columnReader=await queryMorkahjaReadOnly({
      dbUser:role,dbName:'babuni_fixture',
    },5432,password,'overview')
    assert.deepEqual(columnReader,{ok:false,code:'DB_ROLE_RAW_READ_ACCESS'})
    await pool.query('REVOKE SELECT (data) ON public.sessions FROM '+role)
    await pool.query("INSERT INTO players(id,data) SELECT 'preview-'||n, "+
      "jsonb_build_object('playerName','Preview '||n,'lastPlayedAt',"+(Date.now()-100000)+
      "+n,'identityPublicKey','HIDDEN_KEY','activeSessionId',NULL) "+
      "FROM generate_series(1,45) AS n ON CONFLICT (id) DO NOTHING")
    await pool.query("INSERT INTO avatars(id,player_id,data) SELECT 'avatar-preview-'||n,"+
      "'preview-'||n,jsonb_build_object('name','Preview Avatar') "+
      "FROM generate_series(1,45) AS n ON CONFLICT (id) DO NOTHING")
    await pool.query("UPDATE players SET data=jsonb_set(data,'{activeSessionId}',"+
      "to_jsonb('preview-session'::text)) WHERE id='preview-1'")
    await pool.query("INSERT INTO sessions(id,player_id,data) VALUES "+
      "('preview-session','preview-1',jsonb_build_object('expiresAt',$1::bigint,'token','HIDDEN_TOKEN'))",
      [Date.now()+600000])
    const beforeSessions=(await pool.query('SELECT COUNT(*)::integer AS n FROM sessions')).rows[0].n
    const config={dbUser:role,dbName:'babuni_fixture'}
    const endpoint=5432
    const overview=await queryMorkahjaReadOnly(config,endpoint,password,'overview')
    assert.equal(overview.ok,true)
    assert.ok(overview.data.players>=45)
    assert.ok(overview.data.avatars>=45)
    assert.ok(overview.data.activeSessions>=1)
    assert.ok(overview.data.eventsLast24h>=0)
    assert.deepEqual(Object.keys(overview.data).sort(),
      ['players','avatars','activeSessions','eventsLast24h'].sort())
    const first=await queryMorkahjaReadOnly(config,endpoint,password,'players',1)
    const second=await queryMorkahjaReadOnly(config,endpoint,password,'players',2)
    assert.equal(first.ok,true)
    assert.equal(second.ok,true)
    assert.equal(first.data.pageSize,20)
    assert.equal(first.data.players.length,20)
    assert.equal(second.data.players.length,20)
    assert.equal(first.data.total,second.data.total)
    assert.ok(first.data.total>=45)
    for(const row of [...first.data.players,...second.data.players]){
      assert.deepEqual(Object.keys(row).sort(),['displayName','avatarCount','lastPlayedAt'].sort())
      assert.ok(typeof row.displayName==='string')
    }
    const exposed=JSON.stringify({overview,first,second})
    assert.equal(exposed.includes('HIDDEN_KEY'),false)
    assert.equal(exposed.includes('HIDDEN_TOKEN'),false)
    assert.equal(exposed.includes('identityPublicKey'),false)
    assert.equal((await pool.query('SELECT COUNT(*)::integer AS n FROM sessions')).rows[0].n,beforeSessions)
    const denied=await queryMorkahjaReadOnly({
      dbUser:'fixture',dbName:'babuni_fixture',
    },endpoint,'fixture-only','overview')
    assert.deepEqual(denied,{ok:false,code:'DB_ROLE_NOT_READ_ONLY'})
  }finally{
    await pool.query("DELETE FROM sessions WHERE id='preview-session'")
    await pool.query("DELETE FROM avatars WHERE id LIKE 'avatar-preview-%'")
    await pool.query("DELETE FROM players WHERE id LIKE 'preview-%'")
    await pool.query('REVOKE SELECT ON public.sessions FROM '+role)
    await pool.query('REVOKE SELECT ON babuni_admin_ro.overview, babuni_admin_ro.player_preview FROM '+role)
    await pool.query('REVOKE USAGE ON SCHEMA babuni_admin_ro FROM '+role)
    await pool.query('DROP ROLE IF EXISTS '+role)
    await pool.query('DROP SCHEMA IF EXISTS babuni_admin_ro CASCADE')
  }
})
