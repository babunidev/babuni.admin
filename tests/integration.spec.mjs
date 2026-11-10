import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'

let tempRoot
let server
let apiServer
let base
let mockAdminClient
let mockContentClient
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
  // Compact snapshots of actual Morkahja content (see fixture provenance).
  for (const fileName of ['encountersdata.json','solutiondata.json','expansiondata.json',
    'frames.json','portraits.json']) {
    const original = await readFile(new URL('./fixtures/legacy/' + fileName, import.meta.url))
    await writeFile(join(game, fileName), original)
  }
  server = await createServer({
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true },
  })
  const content = await server.ssrLoadModule('/vite/localContentPlugin.ts')
  const admin = await server.ssrLoadModule('/vite/localAdminPlugin.ts')
  mockAdminClient = await server.ssrLoadModule('/src/features/morkahja/services/adminApi.ts')
  mockContentClient = await server.ssrLoadModule('/src/features/morkahja/services/contentApi.ts')
  const handlers = []
  const harness = { middlewares: { use: handler => handlers.push(handler) } }
  content.morkahjaLocalContentPlugin(tempRoot).configureServer(harness)
  admin.morkahjaLocalAdminPlugin('fixture-only-no-database', operations).configureServer(harness)
  apiServer = createHttpServer((req, res) => {
    let index = 0
    const next = () => {
      const handler = handlers[index++]
      if (handler) handler(req, res, next)
      else {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'NOT_FOUND' }))
      }
    }
    next()
  })
  await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve))
  base = 'http://127.0.0.1:' + apiServer.address().port
})

after(async () => {
  await new Promise(resolve => apiServer?.close(resolve) ?? resolve())
  await server?.close()
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
})

async function request(path, data) {
  const response = await fetch(base + path, data === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(data),
  })
  return { status: response.status, body: await response.json() }
}
const content = kind => '/local-content-api/' + kind
const admin = path => '/local-admin-api/' + path
const onDisk = async file => JSON.parse(await readFile(join(tempRoot, 'game', file), 'utf8'))


test('legacy static asset serving rejects symlinks to files outside the project root', async () => {
  const privateFile = join(tempRoot, 'private-fixture.txt')
  const alias = join(tempRoot, 'game', 'outside-alias.txt')
  await writeFile(privateFile, 'DISPOSABLE_PRIVATE_FIXTURE')
  await symlink(privateFile, alias)
  try {
    const forbidden = await fetch(base + '/game/outside-alias.txt')
    assert.equal(forbidden.status, 404)
    assert.equal((await forbidden.text()).includes('DISPOSABLE_PRIVATE_FIXTURE'), false)
    assert.equal((await fetch(base + '/game/portraits.json')).status, 200)
    assert.equal((await fetch(base + '/gameevil/portraits.json')).status, 404)
    const foreign = await fetch(base + '/game/portraits.json', {
      headers: {Origin:'https://attacker.invalid','Sec-Fetch-Site':'cross-site'},
    })
    assert.equal(foreign.status, 403)
  } finally {
    await rm(alias, {force:true})
    await rm(privateFile, {force:true})
  }
})

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
  await writeFile(join(tempRoot, 'game', 'solutiondata.json'),
    await readFile(new URL('./fixtures/legacy/solutiondata.json', import.meta.url)))
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

test('client-side mock moderation and player inspection reject missing accounts', async () => {
  const detail = await mockAdminClient.fetchPlayerDetail('p-001')
  assert.equal(detail.playerId, 'p-001')
  await assert.rejects(() => mockAdminClient.fetchPlayerDetail('missing'), /PLAYER_NOT_FOUND/)
  for (const [method, value] of [
    ['timeoutPlayer', { playerId: 'missing', durationMinutes: 15 }],
    ['banPlayer', { playerId: 'missing', reason: 'fixture' }],
    ['unbanPlayer', 'missing'],
  ]) {
    await assert.rejects(() => mockAdminClient[method](value), /Player not found/)
  }
})

test('client content adapter rejects HTTP 200 with explicit failed save acknowledgement', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false, message: 'Fixture save was rejected',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  try {
    await assert.rejects(
      () => mockContentClient.createEncounter('00021', { mEncounterID: 21 }),
      /Fixture save was rejected/,
    )
    await assert.rejects(
      () => mockContentClient.createFrame({ frameID: 21 }),
      /Fixture save was rejected/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('filesystem write failures return non-success and preserve original fixture data', async () => {
  const path = join(tempRoot, 'game', 'encountersdata.json')
  const initial = await readFile(path, 'utf8')
  const directory = join(tempRoot, 'game')
  await chmod(directory, 0o555)
  try {
    const result = await request(content('encounters'), {
      key: '00077', data: { mEncounterID: 77, mEncounterTitle: 'Should not persist' },
    })
    assert.equal(result.status, 500)
    assert.notEqual(result.body.ok, true)
    assert.equal(await readFile(path, 'utf8'), initial)
  } finally {
    await chmod(directory, 0o755)
  }
})

test('all local admin and file endpoints refuse cross-origin requests', async () => {
  for (const route of [admin('players'), content('encounters')]) {
    const response = await fetch(base + route, {
      headers: { Origin: 'http://external.example', 'Sec-Fetch-Site': 'cross-site' },
    })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'LOCAL_ONLY')
  }
})

test('oversized request bodies fail without writing data', async () => {
  const original = await readFile(join(tempRoot,'game','frames.json'),'utf8')
  const payload = { frameID: 3, padding: 'A'.repeat(9 * 1024 * 1024) }
  const response = await request(content('frames'), payload)
  assert.equal(response.status, 413)
  assert.equal(await readFile(join(tempRoot,'game','frames.json'),'utf8'), original)
})

test('successful updates preserve a versioned backup, and recovery restores it', async () => {
  const file = join(tempRoot,'game','frames.json')
  const before = await readFile(file)
  const response = await request(content('frames'), {frameID:5,name:'Changed'})
  assert.equal(response.status, 201)
  const names = await readdir(join(tempRoot,'game'))
  const backups = names.filter(name => name.startsWith('frames.json.bak-'))
  assert.ok(backups.length > 0)
  const latest = join(tempRoot,'game',backups[backups.length-1])
  assert.deepEqual(await readFile(latest), before)
  const writes = await server.ssrLoadModule('/vite/atomicGameWrites.ts')
  writes.restoreBackup(file,latest)
  assert.deepEqual(await readFile(file),before)
})

test('symlinked content targets cannot be overwritten through local API', async () => {
  const victim = join(tempRoot,'game','safe-victim.json')
  await writeFile(victim,'{"safe":true}')
  const target = join(tempRoot,'game','portraits.json')
  await rm(target)
  await symlink(victim,target)
  try {
    const result = await request(content('portraits'),{avatarID:1,name:'Unsafe'})
    assert.equal(result.status, 500)
    assert.notEqual(result.body.ok,true)
    assert.equal(await readFile(victim,'utf8'),'{"safe":true}')
  } finally {
    await rm(target)
    await writeFile(target,await readFile(new URL('./fixtures/legacy/portraits.json',import.meta.url)))
  }
})

test('legacy game data fields and metadata survive isolated updates', async () => {
  const encounters = await onDisk('encountersdata.json')
  assert.equal(encounters['19001'].mEncounterID,19001)
  assert.ok(Object.hasOwn(encounters['19001'],'mEncounterSolutiuonB'))
  const solutions = await onDisk('solutiondata.json')
  assert.equal(solutions['10001'].mSolutionID,10001)
  const expansions = await onDisk('expansiondata.json')
  assert.ok(expansions._meta)
  assert.equal(expansions.expansions['1001'].mExtensioID,1001)
  const frames = await onDisk('frames.json')
  assert.equal(frames.Frames[1].frameID,1)
  const portraits = await onDisk('portraits.json')
  assert.equal(portraits.Avatar[1].avatarID,1)
  await request(content('expansions'),{key:'1003',data:{mExtensioID:1003,mExtensioName:'New fixture'}})
  const rewritten = await onDisk('expansiondata.json')
  assert.deepEqual(rewritten._meta,expansions._meta)
  assert.deepEqual(rewritten.expansions['1001'],expansions.expansions['1001'])
})

test('Morkahja game JSON is read and written in server/game, images stay in client/public', async () => {
  const layout = await mkdtemp(join(tmpdir(), 'babuni-admin-layout-'))
  try {
    const publicRoot = join(layout, 'client', 'public')
    const serverGame = join(layout, 'server', 'game')
    await mkdir(join(publicRoot, 'game'), { recursive: true })
    await mkdir(join(publicRoot, 'UI'), { recursive: true })
    await mkdir(serverGame, { recursive: true })
    for (const fileName of ['encountersdata.json','solutiondata.json','expansiondata.json',
      'frames.json','portraits.json']) {
      const original = await readFile(new URL('./fixtures/legacy/' + fileName, import.meta.url))
      await writeFile(join(serverGame, fileName), original)
    }

    const plugin = await server.ssrLoadModule('/vite/localContentPlugin.ts')
    assert.equal(plugin.resolveMorkahjaGameDataDir({}, publicRoot), serverGame)
    assert.equal(
      plugin.resolveMorkahjaGameDataDir({ MORKAHJA_GAME_DATA: '/elsewhere/game' }, publicRoot),
      '/elsewhere/game',
    )
    assert.equal(
      plugin.resolveMorkahjaGameDataDir({}, join(layout, 'old', 'checkout', 'client', 'public')),
      join(layout, 'old', 'checkout', 'client', 'public', 'game'),
      'older checkouts without server/game keep using client/public/game',
    )

    const handlers = []
    plugin.morkahjaLocalContentPlugin(publicRoot, serverGame)
      .configureServer({ middlewares: { use: handler => handlers.push(handler) } })
    const local = createHttpServer((req, res) => {
      let index = 0
      const next = () => {
        const handler = handlers[index++]
        if (handler) handler(req, res, next)
        else { res.statusCode = 404; res.end('{}') }
      }
      next()
    })
    await new Promise(resolve => local.listen(0, '127.0.0.1', resolve))
    const localBase = 'http://127.0.0.1:' + local.address().port
    const post = async (path, data) => {
      const response = await fetch(localBase + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: localBase },
        body: JSON.stringify(data),
      })
      return { status: response.status, body: await response.json() }
    }
    try {
      const entry = { mEncounterID: 3, mEncounterTitle: 'Server game data' }
      assert.equal((await post('/local-content-api/encounters', { key: '00003', data: entry })).status, 201)
      const saved = JSON.parse(await readFile(join(serverGame, 'encountersdata.json'), 'utf8'))
      assert.deepEqual(saved['00003'], entry)
      assert.deepEqual(await readdir(join(publicRoot, 'game')), [], 'no JSON copy in client/public/game')

      const served = await fetch(localBase + '/game/encountersdata.json')
      assert.deepEqual((await served.json())['00003'], entry)

      const image = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'
      const upload = await post('/local-content-api/upload/encounter-image',
        { fileName: 'layout_scene', dataBase64: image })
      assert.equal(upload.status, 201)
      const written = await readFile(join(publicRoot, 'game', 'encounterimages', 'layout_scene.webp'))
      assert.equal(written.subarray(0, 4).toString(), 'RIFF')
    } finally {
      await new Promise(resolve => local.close(resolve))
    }
  } finally {
    await rm(layout, { recursive: true, force: true })
  }
})
