import assert from 'node:assert/strict'
import { mkdir, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { before, after, test } from 'node:test'
import { chromium } from 'playwright'

// Runs against a plain Vite dev server with no local service: every
// /local-connections-api request is answered by this test with synthetic data.
const base = process.env.BROWSER_TEST_BASE_URL || 'http://127.0.0.1:4190'
if (!base.startsWith('http://127.0.0.1:')) throw new Error('Save progress test needs a localhost Vite server')
// Optional: BABUNI_SCREENSHOT_DIR keeps a picture of each stage.
const shots = process.env.BABUNI_SCREENSHOT_DIR

let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

const PROFILE = '00000000-0000-4000-8000-000000000001'
const solutions = {
  10002: {
    mSolutionID: 10002, mSolutionIconName: 'haggling', mSolutionInventoryType: 2, mSolutionName: 'Haggling',
    mSolutionRewardType: 1, mSolutionText: 'Fixture text.', mSolutionType: 3, mSolutionUses: 1,
  },
}

function held() {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  return { gate, release }
}

async function shot(page, what) {
  if (!shots) return
  await mkdir(shots, { recursive: true })
  const day = new Date().toISOString().slice(0, 10)
  let file = join(shots, `${day}-${what}.png`)
  for (let n = 2; await access(file).then(() => true, () => false); n++) file = join(shots, `${day}-${what}-${n}.png`)
  await page.screenshot({ path: file })
  console.log('screenshot:', file.replace(homedir(), '~'))
}

const ndjson = (...lines) => lines.map((line) => JSON.stringify(line)).join('\n') + '\n'
const marks = (dialog) => dialog.locator('ol > li > span').evaluateAll((spans) => spans.map((s) => s.getAttribute('aria-label')))

test('a live solution save lists every step at once and ticks them off in order', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const upload = held()
  const write = held()
  const seen = { upload: false, write: false }
  try {
    await page.route('**/local-connections-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/local-connections-api', '')
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
      if (path === '/session') return json({ session: 'fixture-session-'.repeat(4) })
      if (path === '/') return json({ profiles: [{ id: PROFILE, projectId: 'morkahja', kind: 'postgres-ssh-moderation', displayName: 'Admin fixture', target: 'fixture.example.invalid' }] })
      if (path.endsWith('/content-read')) {
        const { kind } = route.request().postDataJSON()
        const data = kind === 'solutions' ? solutions : kind === 'encounters' ? {} : kind === 'expansions' ? { expansions: {} } : kind === 'frames' ? { Frames: [] } : { Avatar: [] }
        return json({ ok: true, data, revision: 'rev-' + kind })
      }
      if (path.endsWith('/content-image-status')) return json({ ok: true, phase: 'ready', cached: 0, verified: 0, downloaded: 0 })
      if (path.endsWith('/content-image-sync')) return json({ ok: true })
      if (path.endsWith('/content-image')) return json({ error: 'IMAGE_UNAVAILABLE' }, 422)
      if (path.endsWith('/content-image-upload')) {
        assert.match(route.request().headers().accept, /application\/x-ndjson/)
        seen.upload = true
        await upload.gate
        const git = { ok: true, commit: 'abc1234', message: 'Admin: replace solution icon haggling.webp', url: 'https://github.com/example/game/commit/abc1234' }
        const publicCheck = { ok: true, status: 200, url: 'https://game.example.invalid/solutionimages/haggling.webp' }
        return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(
          { event: 'step', step: 'live', name: 'haggling.webp', replaced: true, publicCheck },
          { event: 'step', step: 'local', git },
          { event: 'done', status: 200, body: { kind: 'solution', name: 'haggling.webp', sha256: 'x', size: 4096, replaced: true, publicCheck, git: { ...git, pushed: true }, checkedAt: '2026-11-21T12:00:00Z' } },
        ) })
      }
      if (path.endsWith('/content-write')) {
        seen.write = true
        await write.gate
        const git = { ok: true, commit: 'def5678', message: 'Admin: update solution 10002 (Haggling)', url: 'https://github.com/example/game/commit/def5678' }
        return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ndjson(
          { event: 'step', step: 'live', via: 'game' },
          { event: 'step', step: 'local', git },
          { event: 'done', status: 200, body: { ok: true, revision: 'rev-2', via: 'game', checkedAt: '2026-11-21T12:00:01Z', git: { ...git, pushed: true } } },
        ) })
      }
      return json({ error: 'NOT_FOUND' }, 404)
    })

    await page.goto(base + '/content/solutions/10002')
    await page.getByRole('dialog', { name: 'Haggling' }).getByRole('button', { name: 'Edit', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Edit solution' })
    await editor.getByLabel(/^Text/).fill('Edited fixture text.')
    await editor.getByLabel('New solution icon').setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } }) })
    await editor.getByRole('button', { name: 'Save changes' }).click()

    // Pressed Save: all seven steps are there; the first has the hourglass.
    const popup = page.getByRole('dialog', { name: 'Saving solution: Haggling' })
    await popup.waitFor()
    assert.deepEqual(await marks(popup), ['Working', 'Waiting', 'Waiting', 'Waiting', 'Waiting', 'Waiting', 'Waiting'])
    assert.equal(await popup.getByRole('button', { name: 'Working…' }).isDisabled(), true)
    await page.keyboard.press('Escape')
    await popup.waitFor()
    await page.waitForTimeout(800)
    await shot(page, 'babuni-admin-save-progress-started')

    // The image is done; the record is now being written.
    upload.release()
    await page.waitForFunction(() => document.querySelectorAll('[role=dialog] ol > li > span[aria-label="Done"]').length === 4)
    await page.waitForTimeout(600)
    assert.deepEqual(await marks(popup), ['Done', 'Done', 'Done', 'Done', 'Working', 'Waiting', 'Waiting'])
    for (let n = 0; !seen.write && n < 50; n++) await page.waitForTimeout(100)
    assert.ok(seen.write)
    await shot(page, 'babuni-admin-save-progress-halfway')

    // The record's three steps finish together, but are checked off one by one from the top.
    write.release()
    // The heading changes only once everything is checked off.
    const done = page.locator('[role=dialog]:has(#save-result-title)')
    let shotTaken = false
    const seenStages = new Set()
    for (let n = 0; n < 60; n++) {
      const now = await marks(done)
      const count = now.filter((mark) => mark === 'Done').length
      assert.deepEqual(now.slice(0, count), Array(count).fill('Done'), 'checks fill in from the top')
      seenStages.add(count)
      if (count === 7) break
      if (count < 7) assert.equal(await page.locator('#save-result-title').textContent(), 'Saving solution: Haggling')
      if (count === 5 && !shotTaken) {
        shotTaken = true
        await shot(page, 'babuni-admin-save-progress-checking-off')
      }
      await page.waitForTimeout(60)
    }
    assert.ok(seenStages.has(5) && seenStages.has(6), `checked off one at a time, saw ${[...seenStages]}`)
    assert.deepEqual(await marks(done), ['Done', 'Done', 'Done', 'Done', 'Done', 'Done', 'Done'])
    await done.getByText('All done').waitFor()
    await page.getByRole('dialog', { name: 'Solution updated: Haggling' }).waitFor()
    await page.waitForTimeout(700)
    await shot(page, 'babuni-admin-save-progress-done')
    // Close fades the popup out first, and only then is it gone.
    const closedAt = Date.now()
    await done.getByRole('button', { name: 'Close' }).click()
    assert.equal(await page.locator('.save-card-out').count(), 1)
    await shot(page, 'babuni-admin-save-progress-closing')
    await page.locator('#save-result-title').waitFor({ state: 'detached' })
    assert.ok(Date.now() - closedAt >= 200, 'the popup stays while it fades out')
    assert.ok(seen.upload)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})
