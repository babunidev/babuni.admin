import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PROGRESSION_FIELDS,normalizeProgression,readProgression,unavailableProgression} from '../local-service/progressionMetrics.mjs'

const config={readOnlyDataEnabled:true,readOnlyMetricFields:[...PROGRESSION_FIELDS]}
const row={achievements_unlocked:'3',players_with_achievements:'2',
  dice_unlocks:'0',expansion_unlocks:'4',invalid_player_documents:'0',
  invalid_dice_shapes:'0',invalid_dice_entries:'0',
  invalid_expansion_shapes:'0',invalid_expansion_entries:'0'}

test('aggregate validation preserves zero and rejects coercion, overflow and inconsistent results',()=>{
  assert.deepEqual(normalizeProgression([row]),{
    achievementsUnlocked:3,playersWithAchievements:2,diceUnlocks:0,expansionUnlocks:4,
  })
  for(const value of [null,undefined,'',false,[],{},'-1','1.5','9007199254740992',NaN,Infinity]) {
    assert.equal(normalizeProgression([{...row,dice_unlocks:value}]).diceUnlocks,null)
  }
  for(const rows of [[],[row,row],null]) assert.deepEqual(normalizeProgression(rows),unavailableProgression())
  assert.equal(normalizeProgression([{...row,players_with_achievements:'4'}]).achievementsUnlocked,null)
  for(const field of ['invalid_player_documents','invalid_dice_shapes','invalid_dice_entries']) {
    for(const value of ['1',null,undefined,false]) {
      assert.equal(normalizeProgression([{...row,[field]:value}]).diceUnlocks,null)
    }
  }
  assert.equal(normalizeProgression([{...row,invalid_expansion_entries:'1'}]).expansionUnlocks,null)
  assert.equal(normalizeProgression([{...row,invalid_expansion_entries:'1'}]).diceUnlocks,0)
})

test('aggregate SQL is never issued without exact independent field approval',async()=>{
  const client={query:async()=>{throw new Error('must not query')}}
  for(const value of [{},{readOnlyMetricFields:PROGRESSION_FIELDS},
    {...config,readOnlyDataEnabled:false},{...config,readOnlyMetricFields:[]},
    {...config,readOnlyMetricFields:[...PROGRESSION_FIELDS,'playerId']}]) {
    assert.deepEqual(await readProgression(client,value),unavailableProgression())
  }
})

test('optional SQL failures recover the transaction; connection failures propagate',async()=>{
  for(const code of ['42P01','42501','42703','42804','42883','22P02','22003','57014','08006']) {
    const queries=[]
    const client={query:async sql=>{
      queries.push(sql)
      if(sql.startsWith('SELECT')) throw Object.assign(new Error('private detail'),{code})
      return {rows:[]}
    }}
    if(code==='08006') await assert.rejects(()=>readProgression(client,config),{code})
    else assert.deepEqual(await readProgression(client,config),unavailableProgression())
    assert.deepEqual(queries.slice(-2),[
      'ROLLBACK TO SAVEPOINT progression_metrics','RELEASE SAVEPOINT progression_metrics'])
  }
})
