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
function fixture({failDelete=false,badRole=false}={}) {
  const queries=[]
  let ended=false
  const client={
    async connect(){},
    async query(sql,args=[]) {
      queries.push({sql,args})
      if(sql.startsWith('SELECT current_user='))return {rows:[{
        right_user:!badRole,right_db:true,nonprivileged:true,
        no_database_create:true,no_membership:true,no_schema_create:true,
        can_edit_player:true,can_revoke_sessions:true,no_extra_write:true,
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
    {playerId:'test-player',reason:'test reason'},{createClient:()=>f.client})
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
    {playerId:'test-player',durationMinutes:15},{createClient:()=>f.client})
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
    {playerId:'test-player'},{createClient:()=>f.client})
  assert.deepEqual(result,{ok:false,code:'DB_MODERATION_ROLE_REJECTED'})
  assert.equal(f.queries.some(q=>q.sql.startsWith('UPDATE')),false)
  assert.equal(f.queries.some(q=>q.sql==='BEGIN READ WRITE'),false)
  assert.equal(f.ended(),true)
})
test('moderation runner refuses disabled config without opening a tunnel',async()=>{
  let opened=false
  const result=await performMorkahjaModeration(profile,'ban',{playerId:'test-player'},{
    readConfig:async()=>({ok:false,code:'REMOTE_MODERATION_DISABLED'}),
    openTunnel:async()=>{opened=true},
  })
  assert.equal(result.code,'REMOTE_MODERATION_DISABLED')
  assert.equal(opened,false)
})
test('moderation runner always closes temporary tunnel after failed query',async()=>{
  let stopped=false
  const result=await performMorkahjaModeration(profile,'ban',{playerId:'test-player'},{
    readConfig:async()=>({ok:true,config}),
    getPassword:async()=> 'fixture',
    openTunnel:async()=>({socketDir:'/tmp/fake',stop:async()=>{stopped=true}}),
    query:async()=>({ok:false,code:'DB_MODERATION_FAILED'}),
  })
  assert.equal(result.code,'DB_MODERATION_FAILED')
  assert.equal(stopped,true)
})
