import pg from 'pg'
import { readProgression } from './progressionMetrics.mjs'
import { inspectReadOnlyDatabase } from './sshPostgresProbe.mjs'
import { verifyModerationRole } from './morkahjaModeration.mjs'

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

// The live Morkahja role can SELECT only from the approved owner-controlled
// views. Never query public.players, sessions, avatars or game_events directly.
const OVERVIEW_SQL = [
  'SELECT players, avatars, active_sessions, events_last_24h',
  'FROM babuni_admin_ro.overview',
].join('\n')

const PLAYERS_SQL = [
  'SELECT display_name, avatar_count, last_played_at',
  'FROM babuni_admin_ro.player_preview',
  'WHERE position > $1 AND position <= $2',
  'ORDER BY position ASC',
  'LIMIT $3',
].join('\n')

// Enforce the view-only trust boundary at runtime, not just through server
// provisioning. A role with raw public-table SELECT rights is rejected.
const BOUNDARY_SQL = [
  'SELECT',
  " has_schema_privilege(current_user,'babuni_admin_ro','USAGE')",
  " AND has_table_privilege(current_user,'babuni_admin_ro.overview','SELECT')",
  " AND has_table_privilege(current_user,'babuni_admin_ro.player_preview','SELECT')",
  ' AS views_allowed,',
  ' EXISTS (',
  ' SELECT 1 FROM pg_class c',
  ' JOIN pg_namespace n ON n.oid=c.relnamespace',
  " WHERE n.nspname='public' AND c.relname IN",
  " ('players','avatars','sessions','game_events','player_achievements')",
  " AND has_any_column_privilege(current_user,c.oid,'SELECT')",
  ' ) AS raw_table_access',
].join('\n')

// Expose only stable PostgreSQL SQLSTATE categories; never reveal server errors,
// table contents, query strings, connection URLs, or credentials to the browser.
export function classifyReadOnlyError(error) {
  const code=typeof error?.code==='string'?error.code:''
  if(code==='42501') return 'DB_READ_PERMISSION_DENIED'
  if(code==='42P01') return 'DB_READ_TABLE_MISSING'
  if(code==='42703') return 'DB_READ_COLUMN_MISSING'
  if(code==='42883' || code==='42804') return 'DB_READ_SCHEMA_MISMATCH'
  if(code==='22P02' || code==='22003') return 'DB_READ_INVALID_DATA'
  if(code==='57014') return 'DB_READ_TIMEOUT'
  if(code==='28P01' || code==='28000') return 'DB_READ_AUTH_FAILED'
  if(code.startsWith('08') || ['ECONNREFUSED','ECONNRESET','ETIMEDOUT',
    'EPIPE','ENOTFOUND','57P01','57P02','57P03'].includes(code)) {
    return 'DB_READ_CONNECTION_FAILED'
  }
  return 'REMOTE_READ_FAILED'
}

function asTimestamp(value) {
  const ms=Number(value)
  return value!==null && Number.isSafeInteger(ms) && ms>=0 &&
    ms<=253402300799999 ? ms : null
}

export async function queryMorkahjaReadOnly(config,endpoint,password,kind,page=1,mode='restricted') {
  if (!['overview','players','dashboard'].includes(kind)) throw new Error('INVALID_READ_OPERATION')
  if (kind!=='overview' && (!Number.isInteger(page) || page<1 || page>1000)) {
    throw new Error('INVALID_PAGE')
  }
  if(mode!=='admin' && mode!=='restricted')return {ok:false,code:'INVALID_READ_OPERATION'}
  if(mode==='restricted') {
    let role
    try { role=await inspectReadOnlyDatabase(config,endpoint,password) }
    catch(error) {return {ok:false,code:classifyReadOnlyError(error)}}
    if(!role.ok)return {ok:false,code:role.code}
  }
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
    if(mode==='admin') {
      // The same administrator credential may use the existing view-only
      // Overview queries; still never run SQL writes from this endpoint.
      await verifyModerationRole(client,config,true)
    } else {
      const boundary=(await client.query(BOUNDARY_SQL)).rows[0]
      if(!boundary?.views_allowed) {
        return {ok:false,code:'DB_READ_PERMISSION_DENIED'}
      }
      if(boundary.raw_table_access) {
        return {ok:false,code:'DB_ROLE_RAW_READ_ACCESS'}
      }
    }
    let overview
    if(kind==='overview' || kind==='dashboard') {
      const result=await client.query(OVERVIEW_SQL)
      const row=result.rows[0]
      overview={
        players:Number(row.players),avatars:Number(row.avatars),
        activeSessions:Number(row.active_sessions),eventsLast24h:Number(row.events_last_24h),
        ...await readProgression(client,config),
      }
      if(kind==='overview') return {ok:true,data:overview}
    }
    const count=await client.query(
      'SELECT COUNT(*)::integer AS total FROM babuni_admin_ro.player_preview')
    const offset=(page-1)*PLAYER_PAGE_SIZE
    const result=await client.query(PLAYERS_SQL,
      [offset,offset+PLAYER_PAGE_SIZE,PLAYER_PAGE_SIZE])
    const players={
      page,pageSize:PLAYER_PAGE_SIZE,total:Number(count.rows[0].total),
      players:result.rows.map(row=>({
        displayName:String(row.display_name).slice(0,80),
        avatarCount:Number(row.avatar_count),
        lastPlayedAt:asTimestamp(row.last_played_at),
      })),
    }
    return {ok:true,data:kind==='dashboard'?{overview,playerPage:players}:players}
  } catch(error) {
    return {ok:false,code:classifyReadOnlyError(error)}
  } finally {
    if(inTransaction) try {await client.query('ROLLBACK')} catch {}
    try {await client.end()} catch {}
  }
}
