import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const admin=readFileSync('src/features/morkahja/services/adminApi.ts','utf8')
const players=readFileSync('src/features/morkahja/pages/PlayersPage.tsx','utf8')
const content=readFileSync('src/features/morkahja/pages/ContentPage.tsx','utf8')

test('legacy PostgreSQL player list fails closed rather than returning samples or another API',()=>{
  const source=admin.split('export async function fetchPlayersWithMeta()')[1]
    .split('export async function fetchPlayers()')[0]
  const localBranch=source.split('if (useLocalPostgres) {')[1].split('if (useMockData)')[0]
  assert.match(localBranch,/await localGet<Player\[\]>\('\/players'\)/)
  assert.doesNotMatch(localBranch,/getMockPlayers|apiGet|isSample:\s*true/)
})

test('legacy PostgreSQL player detail does not fall back to mock accounts',()=>{
  const source=admin.split('export async function fetchPlayerDetail(')[1]
    .split('export function formatPlayersLoadError')[0]
  const localBranch=source.split('if (useLocalPostgres) {')[1].split('if (useMockData)')[0]
  assert.match(localBranch,/return localGet<PlayerDetail>/)
  assert.doesNotMatch(localBranch,/getMockPlayerDetail|catch/)
})

test('privileged pages disclose old data sources rather than impersonating the approved Overview tunnel',()=>{
  assert.match(players,/Morkahja administrator connection/)
  assert.match(players,/Last scoped read succeeded/)
  assert.match(content,/Morkahja administrator connection/)
  assert.match(content,/Static assets and legacy API/)
})

test('content page reports source errors rather than silently treating them as empty content',()=>{
  assert.match(content,/activeContentError/)
  assert.match(content,/No fallback data is shown/)
  assert.match(content,/role="alert"/)
})
