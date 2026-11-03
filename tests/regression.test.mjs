import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'

async function load(relativePath) {
  const result = await build({
    entryPoints: [relativePath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}

test('player list sorts online first, status next, then recent activity without mutating input', async () => {
  const { sortPlayersForList, countOnlinePlayers } = await load('src/features/morkahja/utils/players.ts')
  const player = (id, status, isOnline, date) => ({
    id, status, isOnline, lastSeen: date,
  })
  const input = [
    player('banned', 'banned', false, '2026-11-03T10:00:00Z'),
    player('older', 'online', true, '2026-11-01T10:00:00Z'),
    player('timeout', 'timed_out', false, '2026-11-03T10:00:00Z'),
    player('newer', 'online', true, '2026-11-03T10:00:00Z'),
    player('offline', 'offline', false, '2026-11-03T10:00:00Z'),
  ]
  assert.deepEqual(sortPlayersForList(input).map(p => p.id),
    ['newer', 'older', 'offline', 'timeout', 'banned'])
  assert.equal(countOnlinePlayers(input), 2)
  assert.equal(input[0].id, 'banned')
})

test('encounter draft uses the established defaults and keeps all four solution slots empty', async () => {
  const { createDefaultEncounterDraft, formatEncounterTypeLabel } = await load('src/features/morkahja/utils/gameDataReference.ts')
  const draft = createDefaultEncounterDraft()
  assert.equal(draft.mEncounterTitle, 'New encounter')
  assert.equal(draft.mEncounterType, 1)
  assert.deepEqual(['A', 'B', 'C', 'D'].map(slot => draft['mEncounterSolutiuon' + slot]), [0, 0, 0, 0])
  assert.match(formatEncounterTypeLabel(1), /Combat/)
  assert.equal(formatEncounterTypeLabel(999), 'Type 999')
})

test('encounter detail resolves padded solution keys, secondary types, expansion and follow-up', async () => {
  const { buildEncounterDetail, findSolutionById, findSolutionByType } = await load('src/features/morkahja/utils/encounterDetail.ts')
  const { createDefaultEncounterDraft } = await load('src/features/morkahja/utils/gameDataReference.ts')
  const encounter = {
    ...createDefaultEncounterDraft(),
    mEncounterID: 41, mEncounterExpansion: 3, mEncounterFollow: 42,
    mEncounterSolutiuonA: 9, mEncounterSolutiuonTypeA: 7,
  }
  const solutions = { '00009': { mSolutionID: 9, mSolutionType: 7 } }
  const encounters = {
    '00041': encounter,
    '00042': { ...createDefaultEncounterDraft(), mEncounterID: 42, mEncounterTitle: 'Next step' },
  }
  const expansions = { expansions: { '00003': { mExtensioID: 3, mExtensioName: 'Northern chapter' } } }
  assert.equal(findSolutionById(solutions, 9)?.mSolutionID, 9)
  assert.equal(findSolutionByType(solutions, 7)?.mSolutionID, 9)
  assert.equal(findSolutionById(solutions, 0), undefined)
  const detail = buildEncounterDetail('00041', encounter, solutions, encounters, expansions)
  assert.equal(detail.expansionName, 'Northern chapter')
  assert.deepEqual(detail.followEncounter, { key: '00042', title: 'Next step', id: 42 })
  assert.deepEqual(detail.slots.map(s => s.slot), ['A', 'B', 'C', 'D'])
  assert.equal(detail.slots[0].primarySolution?.mSolutionID, 9)
  assert.equal(detail.slots[1].primarySolution, undefined)
})

test('mock moderation changes isolated in-memory records without live network or DB access', async () => {
  const mocks = await load('src/features/morkahja/services/mockState.ts')
  const baseline = mocks.getMockPlayers()
  assert.ok(baseline.length > 0)
  const id = baseline.find(p => p.status === 'online')?.id
  assert.ok(id)
  assert.equal(mocks.mockTimeoutPlayer('missing-player', 5), null)
  mocks.mockTimeoutPlayer(id, 10, 'fixture test')
  assert.equal(mocks.getMockPlayers().find(p => p.id === id)?.status, 'timed_out')
  mocks.mockBanPlayer(id, 'fixture ban')
  assert.equal(mocks.getMockPlayers().find(p => p.id === id)?.status, 'banned')
  mocks.mockUnbanPlayer(id)
  const restored = mocks.getMockPlayers().find(p => p.id === id)
  assert.equal(restored?.status, 'offline')
  assert.equal(restored?.banReason, undefined)
  assert.equal(mocks.getMockDashboardStats().bannedPlayers, baseline.filter(p => p.status === 'banned').length)
})

test('original Morkahja routes remain declared in app router', async () => {
  const app = await readFile('src/App.tsx', 'utf8')
  for (const route of ['players', 'players/:playerId', 'content', 'content/:kind/:itemKey', 'settings']) {
    assert.ok(app.includes('path="' + route + '"'), 'missing route ' + route)
  }
  assert.match(app, /<Route index element=/)
})
