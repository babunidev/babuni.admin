import pg from 'pg'
import { inspectReadOnlyDatabase } from './sshPostgresProbe.mjs'

export const PLAYER_PAGE_SIZE = 20
export const READ_ONLY_FIELDS = ['displayName', 'avatarCount', 'lastPlayedAt']

export function parsePlayerPage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !Object.hasOwn(value, 'page') ||
      !Number.isInteger(value.page) || value.page < 1 || value.page > 1000) {
    throw new Error('INVALID_PAGE')
  }
  return value.page
}

const OVERVIEW_SQL = [
  'SELECT',
  ' (SELECT COUNT(*)::integer FROM players) AS players,',
  ' (SELECT COUNT(*)::integer FROM avatars) AS avatars,',
  ' (SELECT COUNT(*)::integer FROM sessions s JOIN players p ON p.id=s.player_id',
  "   WHERE p.data->>'activeSessionId'=s.id AND",
  "     (CASE WHEN (s.data->>'expiresAt') ~ '^[0-9]{1,15}$'",
  "     THEN (s.data->>'expiresAt')::bigint ELSE NULL END) > $1) AS active_sessions,",
  ' (SELECT COUNT(*)::integer FROM game_events WHERE timestamp >= $2) AS recent_events',
].join('\n')

const PLAYERS_SQL = [
  "SELECT LEFT(COALESCE(NULLIF(p.data->>'playerName',''),'Unnamed player'),80) AS display_name,",
  " (CASE WHEN (p.data->>'lastPlayedAt') ~ '^[0-9]{1,15}$'",
  "   THEN (p.data->>'lastPlayedAt')::bigint ELSE NULL END) AS last_seen_ms,",
  ' (SELECT COUNT(*)::integer FROM avatars a WHERE a.player_id=p.id) AS avatar_count',
  ' FROM players p',
  " ORDER BY (CASE WHEN (p.data->>'lastPlayedAt') ~ '^[0-9]{1,15}$'",
  "   THEN (p.data->>'lastPlayedAt')::bigint ELSE NULL END) DESC NULLS LAST, p.id ASC",
  ' LIMIT $1 OFFSET $2',
].join('\n')

function asTimestamp(value) {
  const ms=Number(value)
  return value!==null && Number.isSafeInteger(ms) && ms>=0 &&
    ms<=253402300799999 ? ms : null
}

export async function queryMorkahjaReadOnly(config,endpoint,password,kind,page=1) {
  if (kind!=='overview' && kind!=='players') throw new Error('INVALID_READ_OPERATION')
  if (kind==='players' && (!Number.isInteger(page) || page<1 || page>1000)) {
    throw new Error('INVALID_PAGE')
  }
  const role=await inspectReadOnlyDatabase(config,endpoint,password)
  if (!role.ok) return {ok:false,code:role.code}
  const client=new pg.Client({
    host:typeof endpoint==='string'?endpoint:'127.0.0.1',
    port:typeof endpoint==='string'?5432:endpoint,
    user:config.dbUser,database:config.dbName,
    password,ssl:false,connectionTimeoutMillis:4500,
    query_timeout:3500,statement_timeout:3000,
    application_name:'babuni-admin-read-only-view',
    options:'-c default_transaction_read_only=on',
  })
  let inTransaction=false
  try {
    await client.connect()
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    inTransaction=true
    if(kind==='overview') {
      const now=Date.now()
      const result=await client.query(OVERVIEW_SQL,[now,now-86400000])
      const row=result.rows[0]
      return {ok:true,data:{
        players:Number(row.players),avatars:Number(row.avatars),
        activeSessions:Number(row.active_sessions),eventsLast24h:Number(row.recent_events),
      }}
    }
    const count=await client.query('SELECT COUNT(*)::integer AS total FROM players')
    const result=await client.query(PLAYERS_SQL,[PLAYER_PAGE_SIZE,(page-1)*PLAYER_PAGE_SIZE])
    return {ok:true,data:{
      page,pageSize:PLAYER_PAGE_SIZE,total:Number(count.rows[0].total),
      players:result.rows.map(row=>({
        displayName:String(row.display_name).slice(0,80),
        avatarCount:Number(row.avatar_count),
        lastPlayedAt:asTimestamp(row.last_seen_ms),
      })),
    }}
  } finally {
    if(inTransaction) try {await client.query('ROLLBACK')} catch {}
    try {await client.end()} catch {}
  }
}
