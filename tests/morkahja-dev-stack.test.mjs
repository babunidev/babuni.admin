import test from 'node:test'
import assert from 'node:assert/strict'
import { parseListeners, gameEnv, morkahjaRepo } from '../local-service/morkahjaDevStack.mjs'

test('parses listening pids per port from ss output', () => {
  const out = [
    'LISTEN 0 511 [::1]:5173 [::]:* users:(("MainThread",pid=6279,fd=23))',
    'LISTEN 0 511 *:3000 *:* users:(("MainThread",pid=6301,fd=32))',
    'LISTEN 0 511 0.0.0.0:3000 0.0.0.0:* users:(("MainThread",pid=6301,fd=33))',
  ].join('\n')
  const map = parseListeners(out)
  assert.deepEqual(map.get(5173), [6279])
  assert.deepEqual(map.get(3000), [6301])
})

test('game environment carries no Babuni Admin secrets, ports or npm state', () => {
  const env = gameEnv({
    HOME: '/home/x', PATH: '/home/x/Projects/babuni.admin/node_modules/.bin:/usr/bin',
    BABUNI_LOCAL_SERVICE_TOKEN: 'secret', BABUNI_UI_SESSION_TOKEN: 'secret', VITE_API_TOKEN: 't',
    MORKAHJA_GAME_DATA: '/x', PORT: '5180', DATABASE_URL: 'postgres://x', npm_lifecycle_event: 'dev',
  })
  assert.deepEqual(env, { HOME: '/home/x', PATH: '/usr/bin' })
})

test('game checkout defaults to ~/Projects/MorkahjaWebApp and can be overridden', () => {
  assert.match(morkahjaRepo({}), /\/Projects\/MorkahjaWebApp$/)
  assert.equal(morkahjaRepo({ MORKAHJA_GAME_REPO: '/srv/game' }), '/srv/game')
})
