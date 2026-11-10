import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

async function load(relativePath) {
  const cache = new Map()
  async function compile(file) {
    const absolute = resolve(file)
    if (cache.has(absolute)) return cache.get(absolute)
    const source = await readFile(absolute, 'utf8')
    let js = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      fileName: absolute,
    }).outputText
    const matches = [...js.matchAll(/from ['"](\.[^'"]+)['"]/g)]
    for (const match of matches) {
      const child = await compile(resolve(dirname(absolute), match[1] + '.ts'))
      js = js.replace(match[0], 'from ' + JSON.stringify(child))
    }
    const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
    cache.set(absolute, url)
    return url
  }
  return import(await compile(relativePath))
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
  for (const route of ['dashboard','read-only', 'players', 'players/:playerId', 'content', 'content/:kind/:itemKey', 'settings']) {
    assert.ok(app.includes('path="' + route + '"'), 'missing route ' + route)
  }
  assert.match(app, /<Route index element={<ReadOnlyDashboardPage \/>} \/>/)
  assert.match(app, /path="dashboard" element={<DashboardPage \/>}/)
})

test('shared shell uses project-owned navigation and reusable controls', async () => {
  const app = await readFile('src/App.tsx', 'utf8')
  const layout = await readFile('src/app/AdminLayout.tsx', 'utf8')
  const sidebar = await readFile('src/app/Sidebar.tsx', 'utf8')
  const navigation = await readFile('src/app/navigation.ts', 'utf8')
  const morkahjaNavigation = await readFile('src/features/morkahja/navigation.ts', 'utf8')
  const topBar = await readFile('src/features/morkahja/components/MorkahjaTopBar.tsx', 'utf8')
  assert.match(app, /\.\/app\/AdminLayout/)
  assert.match(layout, /\.\/Sidebar/)
  assert.match(layout, /features\/morkahja\/components\/MorkahjaTopBar/)
  assert.match(sidebar, /\.\/navigation/)
  assert.match(navigation, /features\/morkahja\/navigation/)
  for (const route of ['/', '/players', '/content', '/settings']) {
    assert.ok(morkahjaNavigation.includes("to: '" + route + "'"))
  }
  assert.match(topBar, /services\/adminApi/)
  for (const component of ['PageHeader', 'Table', 'StatusBadge', 'ConnectionBanner']) {
    const shared = await readFile('src/shared/components/' + component + '.tsx', 'utf8')
    assert.match(shared, new RegExp('export (?:function|interface) ' + component + '\\b|export interface Column'))
  }
})

test('workspace selection follows URL and preserves legacy Morkahja navigation', async () => {
  const { workspaces, workspaceForPath } = await load('src/app/navigation.ts')
  assert.deepEqual(workspaces.map(w => w.id), ['morkahja', 'babuni-dev'])
  assert.equal(workspaceForPath('/').id, 'morkahja')
  assert.equal(workspaceForPath('/players/p-001').id, 'morkahja')
  assert.equal(workspaceForPath('/content/encounters/00001').id, 'morkahja')
  assert.equal(workspaceForPath('/settings').id, 'morkahja')
  assert.equal(workspaceForPath('/babuni-dev').id, 'babuni-dev')
  assert.equal(workspaceForPath('/babuni-dev/').id, 'babuni-dev')
  assert.equal(workspaceForPath('/babuni-dev/other').id, 'babuni-dev')
  assert.equal(workspaceForPath('/babuni-development').id, 'morkahja')
  assert.deepEqual(workspaces[0].navItems.map(item => item.to), ['/', '/players', '/content', '/settings'])
  const devLinks = workspaces[1].navItems.map(item => item.to)
  assert.equal(devLinks[0], '/babuni-dev')
  assert.ok(devLinks.every(link => link === '/babuni-dev' || link.startsWith('/babuni-dev/')))
  assert.equal(new Set(devLinks).size, devLinks.length)
  assert.equal(workspaces[0].navItems[0].label,'Overview')
  assert.equal(workspaces[0].navItems[1].label,'Moderation')
})

test('workspace shell uses URL-derived navigation and distinct top bars without content editing', async () => {
  const app = await readFile('src/App.tsx', 'utf8')
  const layout = await readFile('src/app/AdminLayout.tsx', 'utf8')
  const sidebar = await readFile('src/app/Sidebar.tsx', 'utf8')
  const overview = await readFile('src/features/babuni-dev/pages/OverviewPage.tsx', 'utf8')
  assert.match(app, /path="babuni-dev" element={<OverviewPage \/>}/)
  assert.match(layout, /isBabuniDev \? <BabuniDevTopBar \/> : <MorkahjaTopBar \/>/)
  assert.match(sidebar, /workspaceForPath\(pathname\)/)
  assert.match(sidebar, /navigate\(target.home\)/)
  assert.match(sidebar, /current.navItems.map/)
  assert.match(overview, /Not available yet/)
  assert.doesNotMatch(overview, /fetch\(|localStorage|contentApi/)
})

test('source imports resolve without historical compatibility exports', async () => {
  const retiredDirectories = ['src/components', 'src/layouts', 'src/stores', 'src/utils']
  for (const directory of retiredDirectories) {
    assert.equal(existsSync(directory), false, directory + ' should not contain compatibility shims')
  }
  const removedServices = ['adminApi', 'contentApi', 'mockPlayerDetail', 'mockState']
  const removedTypes = ['encounterDetail', 'gameContent', 'playerDetail']
  for (const name of removedServices) {
    assert.equal(existsSync('src/services/' + name + '.ts'), false)
  }
  for (const name of removedTypes) {
    assert.equal(existsSync('src/types/' + name + '.ts'), false)
  }
  async function checkDirectory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = directory + '/' + entry.name
      if (entry.isDirectory()) {
        await checkDirectory(file)
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        const content = await readFile(file, 'utf8')
        for (const match of content.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
          const target = resolve(dirname(file), match[1])
          const candidates = [target, target + '.ts', target + '.tsx', target + '.js',
            target + '/index.ts', target + '/index.tsx']
          assert.ok(candidates.some(existsSync), file + ' has unresolved import ' + match[1])
        }
      }
    }
  }
  await checkDirectory('src')
  await checkDirectory('vite')
})
