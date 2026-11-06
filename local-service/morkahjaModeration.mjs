import pg from 'pg'

// One-use PostgreSQL client over the existing private SSH socket. This module
// is never imported by the browser and never accepts browser-supplied SQL.
export const MODERATION_ACTIONS=Object.freeze([
  'players','detail','timeout','ban','unban',
])
const MAX_PLAYERS=2000
const MAX_AVATARS=10000
const MAX_PLAYER_ID=128
const MAX_REASON=500

export function validPlayerId(value) {
  return typeof value==='string' && value.length>0 &&
    value.length<=MAX_PLAYER_ID && /^[a-zA-Z0-9_-]+$/.test(value)
}
export function validateModerationRequest(action,body) {
  if(!MODERATION_ACTIONS.includes(action))throw new Error('INVALID_MODERATION_ACTION')
  if(action==='players') {
    if(body!==undefined && (body===null || typeof body!=='object' ||
       Array.isArray(body) || Object.keys(body).length!==0)) throw new Error('INVALID_MODERATION_BODY')
    return {}
  }
  if(!body || typeof body!=='object' || Array.isArray(body) ||
    !validPlayerId(body.playerId))throw new Error('INVALID_MODERATION_BODY')
  const allowed=action==='timeout'?['playerId','durationMinutes','reason']:
    action==='ban'?['playerId','reason']:['playerId']
  if(Object.keys(body).some(key=>!allowed.includes(key)))throw new Error('INVALID_MODERATION_BODY')
  if(action==='timeout' && (!Number.isSafeInteger(body.durationMinutes) ||
    body.durationMinutes<1 || body.durationMinutes>10080))throw new Error('INVALID_MODERATION_BODY')
  if('reason' in body && (typeof body.reason!=='string' ||
    body.reason.length>MAX_REASON || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.reason))) {
    throw new Error('INVALID_MODERATION_BODY')
  }
  return body
}

const ROLE_CHECK=[
  'SELECT current_user=$1 AS right_user, current_database()=$2 AS right_db,',
  ' NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls)',
  ' AS nonprivileged,',
  ' NOT has_database_privilege(current_user,current_database(),\'CREATE\') AS no_database_create,',
  ' NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid) AS no_membership,',
  ' NOT EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname<>\'information_schema\'',
  ' AND n.nspname NOT LIKE \'pg_%\' AND has_schema_privilege(current_user,n.oid,\'CREATE\'))',
  ' AS no_schema_create,',
  ' has_column_privilege(current_user,\'public.players\',\'data\',\'UPDATE\') AS can_edit_player,',
  ' has_table_privilege(current_user,\'public.sessions\',\'DELETE\') AS can_revoke_sessions,',
  ' has_table_privilege(current_user,\'public.players\',\'SELECT\') AS can_read_players,',
  ' has_table_privilege(current_user,\'public.avatars\',\'SELECT\') AS can_read_avatars,',
  ' has_table_privilege(current_user,\'public.sessions\',\'SELECT\') AS can_read_sessions,',
  ' has_table_privilege(current_user,\'public.player_achievements\',\'SELECT\') AS can_read_player_achievements,',
  ' has_table_privilege(current_user,\'public.game_events\',\'SELECT\') AS can_read_game_events,',
  ' has_table_privilege(current_user,\'public.progressions\',\'SELECT\') AS can_read_progressions,',
  ' has_table_privilege(current_user,\'public.inventories\',\'SELECT\') AS can_read_inventories,',
  ' has_table_privilege(current_user,\'public.active_encounters\',\'SELECT\') AS can_read_active_encounters,',
  ' NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace',
  ' WHERE n.nspname<>\'information_schema\' AND n.nspname NOT LIKE \'pg_%\'',
  ' AND c.relkind IN (\'r\',\'p\',\'v\',\'m\') AND',
  ' (has_any_column_privilege(current_user,c.oid,\'INSERT\')',
  ' OR has_table_privilege(current_user,c.oid,\'TRUNCATE,TRIGGER,REFERENCES\')',
  ' OR (has_any_column_privilege(current_user,c.oid,\'UPDATE\')',
  ' AND NOT (n.nspname=\'public\' AND c.relname=\'players\'))',
  ' OR (has_table_privilege(current_user,c.oid,\'DELETE\')',
  ' AND NOT (n.nspname=\'public\' AND c.relname=\'sessions\')))) AS no_extra_write',
  ' FROM pg_roles r WHERE r.rolname=current_user',
].join('\n')

export async function verifyModerationRole(client,config,writing=false) {
  const rows=(await client.query(ROLE_CHECK,[config.dbUser,config.dbName])).rows
  if(rows.length!==1)throw new Error('DB_MODERATION_ROLE_REJECTED')
  const {can_edit_player,can_revoke_sessions,...baseline}=rows[0]
  if(!Object.values(baseline).every(x=>x===true) ||
    (writing && (can_edit_player!==true || can_revoke_sessions!==true)) ||
    // A partially privileged role is not a supported state.
    (can_edit_player!==can_revoke_sessions)) {
    throw new Error('DB_MODERATION_ROLE_REJECTED')
  }
}

function safeInt(value,fallback=0) {
  const n=Number(value)
  return value!==null && value!==undefined && Number.isSafeInteger(n) && n>=0?n:fallback
}
function timestamp(value) {
  const n=Number(value)
  return value!==null && value!==undefined && Number.isSafeInteger(n) &&
    n>=0 && n<=253402300799999?new Date(n).toISOString():null
}
function txt(value,fallback='—',max=80) {
  return typeof value==='string'?value.slice(0,max):fallback
}
function mapPlayer(row,active,avatars,live,now) {
  const data=row.data
  const moderation=data.moderation&&typeof data.moderation==='object'?data.moderation:{}
  const timed=safeInt(moderation.timeoutUntil)>now
  const banned=moderation.banned===true
  const online=!banned && !timed && live.has(row.id)
  const status=banned?'banned':timed?'timed_out':online?'online':'offline'
  const seen=timestamp(data.lastPlayedAt) || timestamp(data.createdAt) || new Date(0).toISOString()
  return {
    id:row.id,name:txt(data.playerName,row.id),status,
    level:safeInt(active?.level,1),
    realm:txt(active?.race,'Unknown',40)+' · '+txt(active?.role,'Unknown',40),
    lastSeen:seen,isOnline:online,
    activeAvatar:active?txt(active.name,'—'):undefined,
    timeoutUntil:timestamp(moderation.timeoutUntil),
    banReason:typeof moderation.banReason==='string'?moderation.banReason.slice(0,MAX_REASON):undefined,
    avatarCount:avatars.length,
    createdAt:timestamp(data.createdAt)||new Date(0).toISOString(),
  }
}
async function selectRows(client,sql,args,maximum) {
  const rows=(await client.query(sql,args)).rows
  if(rows.length>maximum)throw new Error('DB_MODERATION_RESULT_LIMIT')
  return rows
}
function ensureDocument(row) {
  if(!row || !row.data || typeof row.data!=='object' || Array.isArray(row.data)) {
    throw new Error('DB_MODERATION_INVALID_DATA')
  }
  return row
}
async function activeSessionIds(client,ids,now) {
  if(ids.length===0)return new Set()
  const rows=await selectRows(client,
    'SELECT id,player_id,data FROM public.sessions WHERE player_id=ANY($1::text[]) LIMIT 10001',
    [ids],10000)
  const live=new Set()
  for(const session of rows) {
    const expiry=safeInt(session.data?.expiresAt)
    if(expiry>now)live.add(session.player_id+':'+session.id)
  }
  return live
}
async function listPlayers(client) {
  const rows=await selectRows(client,
    'SELECT id,data FROM public.players ORDER BY id LIMIT 2001',[],MAX_PLAYERS)
  const players=rows.map(ensureDocument)
  const ids=players.map(p=>p.id)
  if(ids.length===0)return []
  const avatarRows=await selectRows(client,
    'SELECT id,player_id,data FROM public.avatars WHERE player_id=ANY($1::text[]) LIMIT 10001',
    [ids],MAX_AVATARS)
  const byPlayer=new Map()
  for(const avatar of avatarRows) {
    const list=byPlayer.get(avatar.player_id)||[]
    list.push(avatar)
    byPlayer.set(avatar.player_id,list)
  }
  // The current progression row is authoritative for avatar level. Older
  // avatar documents may contain stale level/experience snapshots.
  const progressionRows=await selectRows(client,
    'SELECT player_id,avatar_id,data FROM public.progressions '+
    'WHERE player_id=ANY($1::text[]) AND id=$2 LIMIT 10001',
    [ids,'current'],10000)
  const progressionByAvatar=new Map(progressionRows.map(row=>[
    row.player_id+':'+row.avatar_id,row.data,
  ]))
  const now=Date.now()
  const sessions=await activeSessionIds(client,ids,now)
  const result=players.map(row=>{
    const avatars=byPlayer.get(row.id)||[]
    const activeRow=avatars.find(a=>a.id===row.data.activeAvatarId)
    const currentProgression=activeRow ?
      progressionByAvatar.get(row.id+':'+activeRow.id) : undefined
    const active=activeRow?.data && currentProgression &&
      typeof currentProgression==='object'
      ? {...activeRow.data,level:currentProgression.level ?? activeRow.data.level}
      : activeRow?.data
    const live=new Set()
    if(sessions.has(row.id+':'+row.data.activeSessionId))live.add(row.id)
    return mapPlayer(row,active,avatars,live,now)
  })
  result.sort((a,b)=>Number(b.isOnline)-Number(a.isOnline) ||
    b.lastSeen.localeCompare(a.lastSeen) || a.id.localeCompare(b.id))
  return result
}
async function playerDetail(client,playerId) {
  const result=await client.query(
    'SELECT id,data FROM public.players WHERE id=$1',[playerId])
  if(result.rows.length===0)return null
  const row=ensureDocument(result.rows[0])
  const d=row.data,now=Date.now()
  const avatars=await selectRows(client,
    'SELECT id,data FROM public.avatars WHERE player_id=$1 ORDER BY id LIMIT 201',
    [playerId],200)
  const avatarIds=avatars.map(a=>a.id)
  const achievements=await selectRows(client,
    'SELECT achievement_id,rank,progress,unlocked_at,updated_at FROM public.player_achievements WHERE player_id=$1 ORDER BY updated_at DESC LIMIT 1001',
    [playerId],1000)
  const events=await selectRows(client,
    'SELECT event_id,timestamp,avatar_id,type,importance,payload FROM public.game_events WHERE player_id=$1 ORDER BY timestamp DESC LIMIT 80',
    [playerId],80)
  const collect=async table=>{
    if(avatarIds.length===0)return new Map()
    const rows=await selectRows(client,
      'SELECT avatar_id,data FROM public.'+table+
      ' WHERE player_id=$1 AND avatar_id=ANY($2::text[]) AND id=$3 LIMIT 201',
      [playerId,avatarIds,'current'],200)
    return new Map(rows.map(r=>[r.avatar_id,r.data]))
  }
  const progression=await collect('progressions')
  const inventory=await collect('inventories')
  const encounter=await collect('active_encounters')
  const active=avatars.find(a=>a.id===d.activeAvatarId)?.data
  const sessions=await activeSessionIds(client,[playerId],now)
  const live=new Set(sessions.has(playerId+':'+d.activeSessionId)?[playerId]:[])
  const summary=mapPlayer(row,active,avatars,live,now)
  const detailAvatars=avatars.map(a=>{
    const p=progression.get(a.id)||{},inv=inventory.get(a.id)||{},en=encounter.get(a.id)||{}
    const level=safeInt(p.level,safeInt(a.data?.level,1))
    const experience=safeInt(p.experience,safeInt(a.data?.experience))
    return {
      id:a.id,name:txt(a.data?.name,a.id),race:txt(a.data?.race,'Unknown',40),
      role:txt(a.data?.role,'Unknown',40),level,experience,
      portrait:typeof a.data?.portrait==='string'?a.data.portrait:undefined,
      frame:typeof a.data?.frame==='string'?a.data.frame:undefined,
      isActive:a.id===d.activeAvatarId,
      lastPlayedAt:timestamp(a.data?.lastPlayedAt)||undefined,
      createdAt:timestamp(a.data?.createdAt)||undefined,
      lastEncounterId:safeInt(a.data?.progression?.lastEncounterId)||undefined,
      editMode:a.data?.editMode===true,
      progression:{level,experience,
        encountersCompleted:safeInt(p.encountersCompleted),
        encountersFailed:safeInt(p.encountersFailed)},
      inventoryCounts:{
        spellbook:Array.isArray(inv.spellbook)?inv.spellbook.length:0,
        items:Array.isArray(inv.items)?inv.items.length:0,
        essences:Array.isArray(inv.essences)?inv.essences.length:0},
      activeEncounterTitle:txt(en.encounterTitle||en.title,'',160)||undefined,
    }
  })
  const currencies={}
  if(d.currencies && typeof d.currencies==='object' && !Array.isArray(d.currencies)) {
    for(const [k,v] of Object.entries(d.currencies)) {
      if(k.length<=60 && typeof v==='number' && Number.isFinite(v))currencies[k]=v
    }
  }
  const loreGemClaims={}
  if(d.loreGemClaims && typeof d.loreGemClaims==='object' && !Array.isArray(d.loreGemClaims)) {
    for(const [k,v] of Object.entries(d.loreGemClaims)) {
      if(k.length<=60 && typeof v==='boolean')loreGemClaims[k]=v
    }
  }
  return {
    summary,playerId,
    identityPublicKey:typeof d.identityPublicKey==='string'?d.identityPublicKey.slice(0,1024):undefined,
    createdAt:summary.createdAt,lastPlayedAt:summary.lastSeen,
    unlockedExpansions:Array.isArray(d.unlockedExpansions)?
      d.unlockedExpansions.filter(Number.isSafeInteger).slice(0,200):[],
    friendIds:Array.isArray(d.friendIds)?d.friendIds.filter(x=>typeof x==='string').slice(0,200):[],
    currencies,loreGemClaims,
    dailyReward:d.dailyReward&&typeof d.dailyReward==='object'?{
      utcDay:txt(d.dailyReward.utcDay,'',40),
      encountersPlayed:safeInt(d.dailyReward.encountersPlayed),
      claimedAt:timestamp(d.dailyReward.claimedAt)||undefined,
    }:undefined,
    avatars:detailAvatars,
    achievements:achievements.map(a=>({
      achievementId:txt(a.achievement_id,'',120),rank:safeInt(a.rank),
      progress:safeInt(a.progress),
      unlockedAt:timestamp(a.unlocked_at)||undefined,
      updatedAt:timestamp(a.updated_at)||new Date(0).toISOString(),
    })),
    recentEncounters:events.filter(e=>typeof e.type==='string' &&
      (e.type.includes('encounter') || e.type.includes('roll') ||
       e.payload?.encounterId || e.payload?.encounterTitle)).map(e=>({
      id:txt(e.event_id,'',120),timestamp:timestamp(e.timestamp)||new Date(0).toISOString(),
      type:txt(e.type,'',100),
      title:txt(e.payload?.encounterTitle||e.payload?.title,'',160)||undefined,
      avatarId:typeof e.avatar_id==='string'?e.avatar_id:undefined,
      outcome:txt(e.payload?.outcome||e.payload?.rollOutcome,'',60)||undefined,
      importance:txt(e.importance,'normal',30),
    })),
  }
}
async function mutate(client,action,request) {
  const rows=(await client.query('SELECT id,data FROM public.players WHERE id=$1 FOR UPDATE',
    [request.playerId])).rows
  if(rows.length===0)return {ok:false,code:'PLAYER_NOT_FOUND'}
  const row=ensureDocument(rows[0]),data={...row.data}
  const moderation=data.moderation && typeof data.moderation==='object' &&
    !Array.isArray(data.moderation)?{...data.moderation}:{}
  if(action==='timeout') {
    data.activeSessionId=null
    data.activeSessionExpiresAt=null
    moderation.banned=false
    moderation.timeoutUntil=Date.now()+request.durationMinutes*60000
    if(request.reason?.trim())moderation.banReason=request.reason.trim()
  } else if(action==='ban') {
    data.activeSessionId=null
    data.activeSessionExpiresAt=null
    moderation.banned=true
    moderation.timeoutUntil=null
    moderation.banReason=request.reason?.trim()||'Banned by admin'
  } else {
    moderation.banned=false
    delete moderation.banReason
  }
  data.moderation=moderation
  await client.query('UPDATE public.players SET data=$2::jsonb WHERE id=$1',
    [row.id,JSON.stringify(data)])
  if(action!=='unban')await client.query(
    'DELETE FROM public.sessions WHERE player_id=$1',[row.id])
  return {ok:true,playerId:row.id,
    message:action==='timeout'?'Timeout applied':action==='ban'?'Ban applied':'Ban removed'}
}
export function classifyModerationError(error) {
  if(['INVALID_MODERATION_ACTION','INVALID_MODERATION_BODY',
    'DB_MODERATION_ROLE_REJECTED','DB_MODERATION_INVALID_DATA',
    'DB_MODERATION_RESULT_LIMIT'].includes(error?.message))return error.message
  if(error?.code==='42501')return 'DB_MODERATION_PERMISSION_DENIED'
  if(error?.code==='57014')return 'DB_MODERATION_TIMEOUT'
  if(error?.code==='42P01'||error?.code==='42703')return 'DB_MODERATION_SCHEMA_MISMATCH'
  if(typeof error?.code==='string' && error.code.startsWith('08'))return 'DB_MODERATION_CONNECTION_LOST'
  return 'DB_MODERATION_FAILED'
}
export async function queryMorkahjaModeration(config,socketDir,password,action,payload,deps={}) {
  let request
  try { request=validateModerationRequest(action,payload) }
  catch(error) {return {ok:false,code:classifyModerationError(error)}}
  const client=(deps.createClient||((options)=>new pg.Client(options)))({
    host:socketDir,port:5432,user:config.dbUser,database:config.dbName,
    password,ssl:false,connectionTimeoutMillis:4500,
    query_timeout:6000,statement_timeout:5000,
    application_name:'babuni-admin-moderation',
    options:'-c default_transaction_read_only=on',
  })
  const writing=['timeout','ban','unban'].includes(action)
  if(writing && process.env.BABUNI_MORKAHJA_MODERATION_WRITES!=='enabled')
    return {ok:false,code:'REMOTE_MODERATION_WRITE_DISABLED'}
  let transaction=false
  try {
    await client.connect()
    // Validate exact permissions without exposing untrusted rows.
    await client.query('BEGIN READ ONLY')
    transaction=true
    await verifyModerationRole(client,config,writing)
    await client.query('ROLLBACK')
    transaction=false
    // The transaction mode is chosen locally, never from browser input.
    await client.query(writing?'BEGIN READ WRITE':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    transaction=true
    await client.query('SET LOCAL statement_timeout = \'5s\'')
    await client.query('SET LOCAL lock_timeout = \'2s\'')
    let data
    if(action==='players')data=await listPlayers(client)
    else if(action==='detail')data=await playerDetail(client,request.playerId)
    else data=await mutate(client,action,request)
    if(data?.ok===false) {
      await client.query('ROLLBACK')
      transaction=false
      return data
    }
    await client.query(writing?'COMMIT':'ROLLBACK')
    transaction=false
    return {ok:true,data}
  } catch(error) {
    return {ok:false,code:classifyModerationError(error)}
  } finally {
    if(transaction)try{await client.query('ROLLBACK')}catch{}
    try{await client.end()}catch{}
  }
}
