import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import pg from 'pg'
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

test('protected PostgreSQL adapter accepts a least-privileged reader and rejects writes',async()=>{
  // CI database only. The dedicated reader has SELECT on players but no table write privileges.
  const role='babuni_fixture_reader'
  await pool.query("CREATE ROLE babuni_fixture_reader LOGIN PASSWORD 'fixture-reader-only'")
  await pool.query('GRANT CONNECT ON DATABASE babuni_fixture TO babuni_fixture_reader')
  await pool.query('GRANT USAGE ON SCHEMA public TO babuni_fixture_reader')
  await pool.query('GRANT SELECT ON public.players TO babuni_fixture_reader')
  const client=new pg.Client({
    host:'127.0.0.1',port:5432,database:'babuni_fixture',
    user:role,password:'fixture-reader-only',ssl:false,
  })
  try{
    await client.connect()
    const protectedQueries=await import('../local-service/morkahjaReadonly.mjs')
    const identity=await protectedQueries.verifyReadonlyRole(client)
    assert.deepEqual(identity,{database:'babuni_fixture',readOnly:true,roleVerified:true})
    assert.equal((await protectedQueries.readDatabaseHealth(client)).readOnly,true)
    const players=await protectedQueries.readPlayerPreview(client)
    assert.ok(players.length>0)
    assert.ok(players.length<=25)
    await client.query('BEGIN READ ONLY')
    await assert.rejects(()=>client.query(
      "UPDATE public.players SET data=jsonb_set(data,'{playerName}','\"forbidden\"')"),
      /read-only|permission denied/i)
    await client.query('ROLLBACK')
  }finally{
    await client.end().catch(()=>{})
    await pool.query('REVOKE SELECT ON public.players FROM babuni_fixture_reader')
    await pool.query('REVOKE USAGE ON SCHEMA public FROM babuni_fixture_reader')
    await pool.query('REVOKE CONNECT ON DATABASE babuni_fixture FROM babuni_fixture_reader')
    await pool.query('DROP ROLE babuni_fixture_reader')
  }
})
