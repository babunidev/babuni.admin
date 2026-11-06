import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
  validateModerationRequest, queryMorkahjaModeration,
} from '../local-service/morkahjaModeration.mjs'
import {performMorkahjaModeration} from '../local-service/morkahjaModerationRunner.mjs'
import {hasCapability} from '../vite/connectionAdapters.ts'

const config={dbUser:'fixture_moderator',dbName:'fixture_db'}
const profile={id:'e6200e1c-e539-4949-9865-aa1707a22878',
  projectId:'morkahja',kind:'postgres-ssh-moderation',target:'example.invalid'}
const player={id:'test-player',data:{playerName:'Test',
  activeSessionId:'test-session',activeSessionExpiresAt:10000,
  moderation:{banned:false}}}
function fixture({failDelete=false,badRole=false,readOnlyRole=false}={}) {
  const queries=[]
  let ended=false
  const client={
    async connect(){},
    async query(sql,args=[]) {
      queries.push({sql,args})
      if(sql.startsWith('SELECT current_user='))return {rows:[{
        right_user:!badRole,right_db:true,nonprivileged:true,
        no_database_create:true,no_membership:true,no_schema_create:true,
        can_edit_player:!readOnlyRole,can_revoke_sessions:!readOnlyRole,no_extra_write:true,
        can_read_players:true,
        can_read_avatars:true,
        can_read_sessions:true,
        can_read_player_achievements:true,
        can_read_game_events:true,
        can_read_progressions:true,
        can_read_inventories:true,
        can_read_active_encounters:true,
      }]}
      if(sql.includes('FOR UPDATE'))return {rows:[structuredClone(player)]}
      if(sql.startsWith('DELETE') && failDelete)throw Object.assign(
        new Error('Injected database failure'),{code:'23514'})
      return {rows:[]}
    },
    async end(){ended=true},
  }
  return {queries,client,ended:()=>ended}
}
test('moderation and read-only profile kinds are independently authorized',()=>{
  assert.equal(hasCapability(profile,'ssh:moderation'),true)
  assert.equal(hasCapability({...profile,kind:'postgres-ssh'},'ssh:moderation'),false)
  assert.equal(hasCapability(profile,'ssh:read'),false)
  assert.equal(hasCapability({...profile,kind:'postgres-ssh'},'ssh:read'),true)
})
test('moderation requests have an exact operation and bounded payload contract',()=>{
  for(const item of [
    ['timeout',{playerId:'p',durationMinutes:0}],
    ['timeout',{playerId:'p',durationMinutes:10081}],
    ['ban',{playerId:'p',sql:'DELETE FROM players'}],
    ['ban',{playerId:'p',reason:'x'.repeat(501)}],
    ['detail',{playerId:'../passwd'}],
    ['unban',{playerId:'p',reason:'unexpected'}],
  ])assert.throws(()=>validateModerationRequest(...item))
  assert.deepEqual(validateModerationRequest('ban',{playerId:'p',reason:'test'}),
    {playerId:'p',reason:'test'})
})
test('ban commits only after player update and matching session revocation',async()=>{
  const f=fixture()
  const result=await queryMorkahjaModeration(config,'/socket','fixture','ban',
    {playerId:'test-player',reason:'test reason'},{createClient:()=>f.client,writeEnabled:'enabled'})
  assert.deepEqual(result.data,{ok:true,playerId:'test-player',message:'Ban applied'})
  assert.equal(result.ok,true)
  const statements=f.queries.map(q=>q.sql)
  assert.ok(statements.includes('BEGIN READ WRITE'))
  assert.ok(statements.some(sql=>sql.startsWith('UPDATE public.players SET data=')))
  assert.ok(statements.some(sql=>sql.startsWith('DELETE FROM public.sessions')))
  assert.ok(statements.includes('COMMIT'))
  assert.equal(f.ended(),true)
  const update=f.queries.find(q=>q.sql.startsWith('UPDATE public.players'))
  const updated=JSON.parse(update.args[1])
  assert.equal(updated.moderation.banned,true)
  assert.equal(updated.activeSessionId,null)
  assert.equal(updated.moderation.banReason,'test reason')
})
test('failed session revocation rolls back the player update and ends the connection',async()=>{
  const f=fixture({failDelete:true})
  const result=await queryMorkahjaModeration(config,'/socket','fixture','timeout',
    {playerId:'test-player',durationMinutes:15},{createClient:()=>f.client,writeEnabled:'enabled'})
  assert.equal(result.ok,false)
  const statements=f.queries.map(q=>q.sql)
  assert.ok(statements.some(sql=>sql.startsWith('UPDATE public.players')))
  assert.ok(statements.includes('ROLLBACK'))
  assert.ok(!statements.includes('COMMIT'))
  assert.equal(f.ended(),true)
})
test('unexpected role privileges block access before any database writes',async()=>{
  const f=fixture({badRole:true})
  const result=await queryMorkahjaModeration(config,'/socket','fixture','ban',
    {playerId:'test-player'},{createClient:()=>f.client,writeEnabled:'enabled'})
  assert.deepEqual(result,{ok:false,code:'DB_MODERATION_ROLE_REJECTED'})
  assert.equal(f.queries.some(q=>q.sql.startsWith('UPDATE')),false)
  assert.equal(f.queries.some(q=>q.sql==='BEGIN READ WRITE'),false)
  assert.equal(f.ended(),true)
})
test('read-only moderator role can list accounts without mutation privileges',async()=>{
  const f=fixture({readOnlyRole:true})
  const result=await queryMorkahjaModeration(config,'/socket','fixture','players',
    {},{createClient:()=>f.client,writeEnabled:'disabled'})
  assert.equal(result.ok,true)
  assert.deepEqual(result.data,[])
  assert.equal(f.queries.some(q=>q.sql==='BEGIN READ WRITE'),false)
  assert.equal(f.queries.some(q=>q.sql.startsWith('DELETE')),false)
  assert.equal(f.ended(),true)
})
test('modification is refused before opening a database client unless explicitly enabled',async()=>{
  let attempted=false
  const result=await queryMorkahjaModeration(config,'/socket','fixture','ban',
    {playerId:'test-player'},{createClient:()=>{attempted=true},writeEnabled:'disabled'})
  assert.deepEqual(result,{ok:false,code:'REMOTE_MODERATION_WRITE_DISABLED'})
  assert.equal(attempted,false)
})
test('moderation runner refuses disabled config without opening a tunnel',async()=>{
  let opened=false
  const result=await performMorkahjaModeration(profile,'ban',{playerId:'test-player'},{
    writeEnabled:'enabled',
    readConfig:async()=>({ok:false,code:'REMOTE_MODERATION_DISABLED'}),
    openTunnel:async()=>{opened=true},
  })
  assert.equal(result.code,'REMOTE_MODERATION_DISABLED')
  assert.equal(opened,false)
})
test('moderation runner always closes temporary tunnel after failed query',async()=>{
  let stopped=false
  const result=await performMorkahjaModeration(profile,'ban',{playerId:'test-player'},{
    writeEnabled:'enabled',
    readConfig:async()=>({ok:true,config}),
    getPassword:async()=> 'fixture',
    openTunnel:async()=>({socketDir:'/tmp/fake',stop:async()=>{stopped=true}}),
    query:async()=>({ok:false,code:'DB_MODERATION_FAILED'}),
  })
  assert.equal(result.code,'DB_MODERATION_FAILED')
  assert.equal(stopped,true)
})

test('live player listing maps current progression, active session, avatar count and moderation state',async()=>{
  const now=Date.now()
  const accounts=[
    {id:'online-player',data:{playerName:'Online account',activeAvatarId:'a1',
      activeSessionId:'sid-1',createdAt:now-200000,lastPlayedAt:now-5000}},
    {id:'banned-player',data:{playerName:'Banned account',activeAvatarId:'b1',
      activeSessionId:null,createdAt:now-400000,lastPlayedAt:now-200000,
      moderation:{banned:true,banReason:'Fixture'}}},
  ]
  const avatars=[
    {id:'a1',player_id:'online-player',data:{name:'Hero',level:2,race:'Elf',role:'Rogue'}},
    {id:'a2',player_id:'online-player',data:{name:'Alt',level:3}},
    {id:'b1',player_id:'banned-player',data:{name:'Villain',level:5}},
  ]
  const sessions=[{id:'sid-1',player_id:'online-player',data:{expiresAt:now+120000,
    secretToken:'DO_NOT_EXPOSE'}}]
  const rows=[{player_id:'online-player',avatar_id:'a1',data:{level:21}}]
  const fixtureClient={
    async connect(){},
    async query(sql) {
      if(sql.startsWith('SELECT current_user='))return {rows:[{
        right_user:true,right_db:true,nonprivileged:true,
        no_database_create:true,no_membership:true,no_schema_create:true,
        can_edit_player:false,can_revoke_sessions:false,no_extra_write:true,
        ...Object.fromEntries(['players','avatars','sessions','player_achievements',
          'game_events','progressions','inventories','active_encounters'].map(
          name=>['can_read_'+name,true])),
      }]}
      if(sql.startsWith('SELECT id,data FROM public.players ORDER'))return {rows:accounts}
      if(sql.startsWith('SELECT id,player_id,data FROM public.avatars'))return {rows:avatars}
      if(sql.startsWith('SELECT player_id,avatar_id,data FROM public.progressions'))return {rows}
      if(sql.startsWith('SELECT id,player_id,data FROM public.sessions'))return {rows:sessions}
      return {rows:[]}
    },
    async end(){},
  }
  const result=await queryMorkahjaModeration(config,'/socket','fixture','players',
    {},{createClient:()=>fixtureClient,writeEnabled:'disabled'})
  assert.equal(result.ok,true)
  assert.equal(result.data.length,2)
  const online=result.data.find(p=>p.id==='online-player')
  const banned=result.data.find(p=>p.id==='banned-player')
  assert.equal(online.name,'Online account')
  assert.equal(online.level,21)
  assert.equal(online.activeAvatar,'Hero')
  assert.equal(online.avatarCount,2)
  assert.equal(online.status,'online')
  assert.equal(banned.status,'banned')
  assert.equal(banned.banReason,'Fixture')
  assert.doesNotMatch(JSON.stringify(result.data),/DO_NOT_EXPOSE|sid-1/)
})
test('missing player detail returns not-found rather than invalid data or mock profile',async()=>{
  const fixtureClient={
    async connect(){},
    async query(sql) {
      if(sql.startsWith('SELECT current_user='))return {rows:[{
        right_user:true,right_db:true,nonprivileged:true,
        no_database_create:true,no_membership:true,no_schema_create:true,
        can_edit_player:false,can_revoke_sessions:false,no_extra_write:true,
        ...Object.fromEntries(['players','avatars','sessions','player_achievements',
          'game_events','progressions','inventories','active_encounters'].map(
          name=>['can_read_'+name,true])),
      }]}
      return {rows:[]}
    },
    async end(){},
  }
  const result=await queryMorkahjaModeration(config,'/socket','fixture','detail',
    {playerId:'missing-player'},{createClient:()=>fixtureClient,writeEnabled:'disabled'})
  assert.deepEqual(result,{ok:true,data:null})
})
