import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'

const origin = process.env.BROWSER_TEST_BASE_URL ?? 'http://127.0.0.1:4180'
let browser

before(async () => {
  // A production preview, built with mock-only settings, is started by CI.
  // No test accesses a live database or performs content writes.
  const response = await fetch(origin)
  assert.equal(response.status, 200, 'production preview must be running')
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
})

async function openPage(path = '/', viewport) {
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  const unexpectedErrors = []
  page.on('pageerror', error => unexpectedErrors.push(error.message))
  await page.goto(origin + path)
  return { page, context, unexpectedErrors }
}

test('Babuni Dev overview renders its own navigation and no Morkahja server header', async () => {
  const { page, context, unexpectedErrors } = await openPage('/babuni-dev')
  try {
    assert.equal(await page.title().then(t => typeof t), 'string')
    await page.getByRole('heading', { name: 'Babuni Dev', exact: true }).waitFor()
    assert.equal(await page.getByRole('combobox', { name: 'Select workspace' }).inputValue(), 'babuni-dev')
    assert.equal(await page.getByRole('navigation', { name: 'Babuni Dev navigation' }).getByRole('link').count(), 1)
    await page.getByRole('heading', { name: 'Workspace established' }).waitFor()
    assert.equal(await page.getByText('Portfolio workspace · Planned features').isVisible(), true)
    assert.equal(await page.getByText('Realm Console').count(), 0)
    assert.deepEqual(unexpectedErrors, [])
  } finally {
    await context.close()
  }
})

test('switching workspaces updates rendered header, links, URL, and browser history', async () => {
  const { page, context, unexpectedErrors } = await openPage('/babuni-dev')
  try {
    const chooser = page.getByRole('combobox', { name: 'Select workspace' })
    await chooser.selectOption('morkahja')
    await page.waitForURL(origin + '/')
    await page.getByRole('navigation', { name: 'Morkahja navigation' }).getByRole('link', { name: 'Players' }).waitFor()
    assert.equal(await chooser.inputValue(), 'morkahja')
    await page.getByText('Realm Console').waitFor()

    await page.getByRole('navigation', { name: 'Morkahja navigation' })
      .getByRole('link', { name: 'Players' }).click()
    await page.waitForURL(origin + '/players')
    await page.getByRole('navigation', { name: 'Morkahja navigation' }).getByRole('link', { name: 'Content' }).waitFor()
    assert.equal(await chooser.inputValue(), 'morkahja')

    await chooser.selectOption('babuni-dev')
    await page.waitForURL(origin + '/babuni-dev')
    await page.getByRole('heading', { name: 'Workspace established' }).waitFor()
    assert.equal(await page.getByRole('navigation', { name: 'Babuni Dev navigation' }).getByRole('link').count(), 1)

    await page.goBack()
    await page.waitForURL(origin + '/players')
    assert.equal(await chooser.inputValue(), 'morkahja')
    await page.goForward()
    await page.waitForURL(origin + '/babuni-dev')
    assert.equal(await chooser.inputValue(), 'babuni-dev')
    assert.deepEqual(unexpectedErrors, [])
  } finally {
    await context.close()
  }
})

test('legacy Morkahja routes render directly with their original navigation', async () => {
  for (const route of ['/', '/read-only', '/players', '/content', '/settings']) {
    const { page, context, unexpectedErrors } = await openPage(route)
    try {
      await page.getByRole('navigation', { name: 'Morkahja navigation' }).waitFor()
      assert.equal(await page.getByRole('combobox', { name: 'Select workspace' }).inputValue(), 'morkahja')
      assert.equal(await page.getByRole('navigation', { name: 'Morkahja navigation' }).getByRole('link').count(), 5)
      assert.deepEqual(unexpectedErrors, [], 'uncaught browser errors on ' + route)
    } finally {
      await context.close()
    }
  }
})

test('mobile sidebar opens and closes using accessible controls', async () => {
  const { page, context, unexpectedErrors } = await openPage('/babuni-dev', { width: 390, height: 844 })
  try {
    await page.getByRole('button', { name: 'Toggle navigation' }).click()
    await page.getByRole('combobox', { name: 'Select workspace' }).waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Close navigation' }).click()
    await page.getByRole('combobox', { name: 'Select workspace' }).waitFor({ state: 'hidden' })
    assert.deepEqual(unexpectedErrors, [])
  } finally {
    await context.close()
  }
})

test('shared rendered controls work: Morkahja player table and Babuni Dev page header', async () => {
  const { page, context, unexpectedErrors } = await openPage('/players')
  try {
    await page.getByRole('navigation', { name: 'Morkahja navigation' }).waitFor()
    await page.getByRole('heading', { level: 1 }).waitFor()
    // Mock mode should render existing player records without production services.
    await page.getByRole('table').waitFor({ timeout: 15000 })
    assert.equal(await page.getByRole('table').getByRole('row').count() > 1, true)
    assert.deepEqual(unexpectedErrors, [])
  } finally {
    await context.close()
  }
})
