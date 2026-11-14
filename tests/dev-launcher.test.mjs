import test from 'node:test'
import assert from 'node:assert/strict'
import { launcherEnv } from '../scripts/devEnv.mjs'
import { readMorkahjaModerationConfig } from '../local-service/morkahjaModerationConfig.mjs'

const profile={projectId:'morkahja',kind:'postgres-ssh-moderation',target:'example.invalid'}

test('npm run dev turns Morkahja moderation on by default', () => {
  const env=launcherEnv({},5191,5180)
  assert.equal(env.BABUNI_MORKAHJA_REMOTE_MODERATION,'enabled')
  assert.equal(env.BABUNI_LOCAL_SERVICE_PORT,'5191')
  assert.equal(env.BABUNI_UI_PORT,'5180')
  assert.match(env.BABUNI_LOCAL_SERVICE_TOKEN,/^[0-9a-f]{64}$/)
  assert.notEqual(env.BABUNI_LOCAL_SERVICE_TOKEN,env.BABUNI_UI_SESSION_TOKEN)
})

test('an explicit shell value still overrides the launcher default', () => {
  assert.equal(launcherEnv({BABUNI_MORKAHJA_REMOTE_MODERATION:'disabled'},5191,5180)
    .BABUNI_MORKAHJA_REMOTE_MODERATION,'disabled')
})

test('the launcher does not switch on other remote gates', () => {
  const env=launcherEnv({},5191,5180)
  assert.equal(env.BABUNI_MORKAHJA_REMOTE_CONTENT,undefined)
  assert.equal(env.BABUNI_MORKAHJA_REMOTE_PROBE,undefined)
})

test('the service still refuses moderation when started without the gate', async () => {
  assert.deepEqual(await readMorkahjaModerationConfig(profile,{}),
    {ok:false,code:'REMOTE_MODERATION_DISABLED'})
})
