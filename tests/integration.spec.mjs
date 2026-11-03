import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

let tempRoot
let server
let base
let failDb = false
const players = new Map([['fixture-1', { id: 'fixture-1', name: 'Fixture Player', status: 'online' }]])
const operations = {
  listPlayers: async () => {
    if (failDb) throw new Error('FIXTURE_DATABASE_UNAVAILABLE')
    return [...players.values()]
  },
  listOnlinePlayers: async () => [...players.values()].filter(p => p.status === 'online'),
  getPlayerDetail: async (_, id) => players.get(id) ?? null,
  getDashboard: async () => ({ onlinePlayers: players.size }),
  getActivity: async () => [],
  timeout: async (_, id, duration) => {
    if (failDb) throw new Error('FIXTURE_WRITE_FAILED')
    const p = players.get(id)
    if (!p) return { ok: false, message: 'Player not found' }
    p.status = 'timed_out'
    p.duration = duration
    return { ok: true, message: 'Player timed out' }
  },
  ban: async (_, id) => {
    if (failDb) throw new Error('FIXTURE_WRITE_FAILED')
    const p = players.get(id)
    if (!p) return { ok: false, message: 'Player not found' }
    p.status = 'banned'
    return { ok: true, message: 'Player banned' }
  },
  unban: async (_, id) => {
    if (failDb) throw new Error('FIXTURE_WRITE_FAILED')
    const p = players.get(id)
    if (!p) return { ok: false, message: 'Player not found' }
    p.status = 'offline'
    return { ok: true, message: 'Player unbanned' }
  },
}

before(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'babuni-admin-fixture-'))
  const game = join(tempRoot, 'game')
  await mkdir(game, { recursive: true })
  await mkdir(join(tempRoot, 'UI'), { recursive: true })
  const initial = {
    'encountersdata.json': {},
    'solutiondata.json': {},
    'expansiondata.json': { expansions: {} },
    'frames.json': { Frames: [] },
    'portraits.json': { Avatar: [] },
  }
  for (const [name, data] of Object.entries(initial)) {
    await writeFile(join(game, name), JSON.stringify(data))
  }
  server = await createServer({
    configFile: false,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  })
  const content = await server.ssrLoadModule('/vite/localContentPlugin.ts')
  const admin = await server.ssrLoadModule('/vite/localAdminPlugin.ts')
  content.morkahjaLocalContentPlugin(tempRoot).configureServer(server)
  admin.morkahjaLocalAdminPlugin('fixture-only-no-database', operations).configureServer(server)
  await server.listen()
  base = 'http://127.0.0.1:' + server.httpServer.address().port
})

after(async () => {
  await server?.close()
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
})

async function request(path, data) {
  const response = await fetch(base + path, data === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return { status: response.status, body: await response.json() }
}
const content = kind => '/local-content-api/' + kind
const admin = path => '/local-admin-api/' + path
const onDisk = async file => JSON.parse(await readFile(join(tempRoot, 'game', file), 'utf8'))

test('isolated player inspection and moderation routes support timeout, ban and unban', async () => {
  const beforePlayer = await request(admin('players/fixture-1'))
  assert.equal(beforePlayer.status, 200)
  assert.equal(beforePlayer.body.name, 'Fixture Player')
  for (const [route, payload, state] of [
    ['players/timeout', { playerId: 'fixture-1', durationMinutes: 15 }, 'timed_out'],
    ['players/ban', { playerId: 'fixture-1', reason: 'fixture' }, 'banned'],
    ['players/unban', { playerId: 'fixture-1' }, 'offline'],
  ]) {
    const result = await request(admin(route), payload)
    assert.equal(result.status, 200, route)
    assert.equal(result.body.ok, true)
    assert.equal(players.get('fixture-1').status, state)
  }
})

test('unknown players, invalid requests and database faults never return success', async () => {
  assert.equal((await request(admin('players/unknown'))).status, 404)
  for (const route of ['players/timeout', 'players/ban', 'players/unban']) {
    const unknown = await request(admin(route), { playerId: 'not-a-player', durationMinutes: 15 })
    assert.equal(unknown.status, 404, route)
    assert.equal(unknown.body.ok, false)
    const invalid = await request(admin(route), {})
    assert.equal(invalid.status, 400)
  }
  const saved = players.get('fixture-1').status
  failDb = true
  try {
    assert.equal((await request(admin('health'))).status, 503)
    const failed = await request(admin('players/ban'), { playerId: 'fixture-1' })
    assert.equal(failed.status, 500)
    assert.notEqual(failed.body.ok, true)
    assert.equal(players.get('fixture-1').status, saved)
  } finally {
    failDb = false
  }
})

test('encounter and solution saves persist only inside temporary fixture files', async () => {
  for (const [kind, name, key, value] of [
    ['encounters', 'encountersdata.json', '00001', { mEncounterID: 1, mEncounterTitle: 'Fixture encounter' }],
    ['solutions', 'solutiondata.json', '00002', { mSolutionID: 2, mSolutionTitle: 'Fixture solution' }],
  ]) {
    const result = await request(content(kind), { key, data: value })
    assert.equal(result.status, 201)
    assert.equal(result.body.ok, true)
    assert.deepEqual((await onDisk(name))[key], value)
    assert.deepEqual((await request(content(kind))).body[key], value)
  }
})

test('expansions, frames and portraits save into their respective fixture formats', async () => {
  const specs = [
    ['expansions', 'expansiondata.json', { key: '00003', data: { mExtensioID: 3, mExtensioName: 'Fixture expansion' } }, 'expansions', '00003'],
    ['frames', 'frames.json', { frameID: 2, name: 'Fixture frame' }, 'Frames', 2],
    ['portraits', 'portraits.json', { avatarID: 4, name: 'Fixture portrait' }, 'Avatar', 4],
  ]
  for (const [kind, file, payload, collection, id] of specs) {
    const result = await request(content(kind), payload)
    assert.equal(result.status, 201, kind)
    assert.equal(result.body.ok, true)
    assert.deepEqual((await onDisk(file))[collection][id], kind === 'expansions' ? payload.data : payload)
  }
})

test('invalid content inputs and missing files are rejected without reporting success', async () => {
  const beforeFile = await readFile(join(tempRoot, 'game', 'encountersdata.json'), 'utf8')
  for (const [kind, body] of [
    ['encounters', {}],
    ['solutions', { key: 'bad', data: null }],
    ['expansions', { key: 'bad' }],
    ['frames', { frameID: 'not-a-number' }],
    ['portraits', { avatarID: -1 }],
  ]) {
    const result = await request(content(kind), body)
    assert.equal(result.status, 400, kind)
    assert.notEqual(result.body.ok, true)
  }
  assert.equal(await readFile(join(tempRoot, 'game', 'encountersdata.json'), 'utf8'), beforeFile)
  await rm(join(tempRoot, 'game', 'solutiondata.json'))
  const readFailure = await request(content('solutions'))
  assert.equal(readFailure.status, 500)
  assert.notEqual(readFailure.body.ok, true)
  const writeFailure = await request(content('solutions'), { key: '00099', data: {} })
  assert.equal(writeFailure.status, 500)
  assert.notEqual(writeFailure.body.ok, true)
})

test('WebP image uploads validate names, data and paths inside fixture directories', async () => {
  const image = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'
  for (const [route, fileName, expected] of [
    ['upload/encounter-image', 'fixture_scene', 'encounterimages/fixture_scene.webp'],
    ['upload/solution-image', 'fixture_icon', 'solutionimages/fixture_icon.webp'],
  ]) {
    const valid = await request(content(route), { fileName, dataBase64: image })
    assert.equal(valid.status, 201, route)
    assert.equal(valid.body.path, expected)
    const output = await readFile(join(tempRoot, 'game', expected))
    assert.equal(output.subarray(0, 4).toString(), 'RIFF')
    for (const bad of ['../escape', '/absolute', 'nested/file', '..']) {
      const result = await request(content(route), { fileName: bad, dataBase64: image })
      assert.equal(result.status, 400, route + ': ' + bad)
      assert.notEqual(result.body.ok, true)
    }
    for (const invalid of ['', 'not-base64']) {
      const result = await request(content(route), { fileName, dataBase64: invalid })
      assert.equal(result.status, 400)
    }
  }
  const titled = await request(content('upload/encounter-image'), {
    encounterTitle: 'Golden Forest',
    encounterId: 9,
    dataBase64: image,
  })
  assert.equal(titled.status, 201)
  assert.equal(titled.body.imageName, 'golden_forest')
})
