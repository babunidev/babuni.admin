import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { chromium } from 'playwright'

const base = process.env.BROWSER_TEST_BASE_URL
if (!base || !base.startsWith('http://127.0.0.1:')) {
  throw new Error('Browser content tests require an explicit localhost fixture server')
}
let browser
before(async () => {
  const response = await fetch(base + '/local-content-api/status')
  assert.equal(response.status, 200, 'isolated fixture middleware must be enabled')
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close() })

async function withPage(fn) {
  const context = await browser.newContext({ viewport: {width:1280,height:850} })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.goto(base + '/content')
    await page.getByRole('heading',{name:'Content',exact:true}).waitFor()
    await fn(page)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
}
async function read(kind) {
  const response = await fetch(base + '/local-content-api/' + kind)
  assert.equal(response.status,200)
  return response.json()
}
async function waitStatus(page, pattern) {
  await page.getByText(pattern).first().waitFor({timeout:12000})
}

test('encounter editor saves a new record into isolated legacy data', async () => {
  await withPage(async page => {
    await page.getByRole('button',{name:'Add encounter',exact:true}).click()
    const dialog = page.getByRole('dialog',{name:'Add encounter'})
    await dialog.getByRole('spinbutton',{name:/^Encounter ID/}).fill('49123')
    await dialog.getByLabel('Title').fill('Browser fixture encounter')
    await dialog.getByRole('button',{name:'Save encounter'}).click()
    await page.getByRole('dialog',{name:'Add encounter'}).waitFor({state:'hidden'})
    const data = await read('encounters')
    assert.equal(data['49123'].mEncounterTitle,'Browser fixture encounter')
    assert.equal(data['19001'].mEncounterID,19001)
  })
})

test('solution editor saves record and converts PNG upload to decodable WebP', async () => {
  await withPage(async page => {
    await page.getByRole('button',{name:'Solutions',exact:true}).click()
    await page.getByLabel('ID', {exact:true}).fill('49124')
    await page.getByLabel('Name',{exact:true}).fill('Browser fixture solution')
    await page.getByLabel('Icon name').fill('fixture_uploaded_icon')
    await page.getByRole('button',{name:'Save solution'}).click()
    await waitStatus(page,'Solution saved to solutiondata.json on disk.')
    const solutions = await read('solutions')
    assert.equal(solutions['49124'].mSolutionName,'Browser fixture solution')
    const screenshot = await page.screenshot()
    await page.getByLabel('Upload solution icon (.webp)').setInputFiles({
      name:'fixture.png', mimeType:'image/png', buffer:screenshot,
    })
    await waitStatus(page,'Saved as fixture_uploaded_icon.webp')
    const decoded = await page.evaluate(async () => {
      const response = await fetch('/game/solutionimages/fixture_uploaded_icon.webp')
      if (!response.ok) return {ok:false}
      const bitmap = await createImageBitmap(await response.blob())
      const result = {ok:true,width:bitmap.width,height:bitmap.height}
      bitmap.close()
      return result
    })
    assert.equal(decoded.ok,true)
    assert.ok(decoded.width > 0 && decoded.height > 0)
  })
})

test('expansion, frame and portrait forms persist their legacy data structures', async () => {
  await withPage(async page => {
    await page.getByRole('button',{name:'Expansions',exact:true}).click()
    await page.getByLabel('ID',{exact:true}).fill('49125')
    await page.getByLabel('Name',{exact:true}).fill('Browser fixture expansion')
    await page.getByRole('button',{name:'Save expansion'}).click()
    await waitStatus(page,'Expansion saved.')
    assert.equal((await read('expansions')).expansions['49125'].mExtensioName,'Browser fixture expansion')

    await page.getByRole('button',{name:'Frames',exact:true}).click()
    await page.getByLabel('Frame ID').fill('925')
    await page.getByRole('button',{name:'Save frame #925'}).click()
    await waitStatus(page,'Frame saved.')
    assert.equal((await read('frames')).Frames[925].frameID,925)

    await page.getByRole('button',{name:'Portraits',exact:true}).click()
    await page.getByLabel('Avatar ID').fill('926')
    await page.getByLabel('Avatar name').fill('Browser fixture portrait')
    await page.getByRole('button',{name:'Save portrait'}).click()
    await waitStatus(page,'Portrait saved.')
    assert.equal((await read('portraits')).Avatar[926].avatarName,'Browser fixture portrait')
  })
})

test('failed editor save displays error and preserves fixture file', async () => {
  await withPage(async page => {
    await page.getByRole('button',{name:'Frames',exact:true}).click()
    const original = JSON.stringify(await read('frames'))
    await page.route('**/local-content-api/frames', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({status:500,contentType:'text/plain',body:'Simulated fixture storage error'})
      } else await route.continue()
    })
    await page.getByLabel('Frame ID').fill('927')
    await page.getByRole('button',{name:'Save frame #927'}).click()
    await waitStatus(page,'Simulated fixture storage error')
    assert.equal(JSON.stringify(await read('frames')),original)
  })
})
