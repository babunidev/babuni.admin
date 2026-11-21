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

test('solution editor uploads the chosen PNG as decodable WebP only on Save', async () => {
  await withPage(async page => {
    await page.getByRole('button',{name:'Solutions',exact:true}).click()
    await page.getByRole('button',{name:'Add solution',exact:true}).click()
    const dialog = page.getByRole('dialog',{name:'Add solution'})
    await dialog.getByLabel('ID', {exact:true}).fill('49124')
    await dialog.getByLabel('Name',{exact:true}).fill('Browser fixture solution')
    await dialog.getByLabel(/^Type \(/).fill('5')
    await dialog.getByLabel('Inventory type').fill('2')
    await dialog.getByLabel('Icon name').fill('fixture_uploaded_icon')
    const screenshot = await page.screenshot()
    await dialog.getByLabel('New solution icon').setInputFiles({
      name:'fixture.png', mimeType:'image/png', buffer:screenshot,
    })
    // Choosing only previews it; nothing is written until Save.
    await waitStatus(page,'Not uploaded yet.')
    // (A missing file gets Vite's HTML fallback, so look for an actual image.)
    const beforeSave = await page.evaluate(async () => {
      const response = await fetch('/game/solutionimages/fixture_uploaded_icon.webp',{cache:'no-store'})
      return response.ok && (response.headers.get('content-type') || '').startsWith('image/')
    })
    assert.equal(beforeSave,false)
    await dialog.getByRole('button',{name:'Save solution'}).click()
    await page.getByRole('dialog',{name:'Add solution'}).waitFor({state:'hidden'})
    await waitStatus(page,'Solution saved.')
    const solutions = await read('solutions')
    assert.equal(solutions['49124'].mSolutionName,'Browser fixture solution')
    assert.equal(solutions['49124'].mSolutionType,5)
    assert.equal(solutions['49124'].mSolutionInventoryType,2)
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

test('solution detail panel Edit button changes an existing solution in place', async () => {
  await withPage(async page => {
    await page.goto(base + '/content/solutions/10002')
    const detail = page.getByRole('dialog',{name:'Haggling'})
    await detail.getByRole('button',{name:'Edit',exact:true}).click()
    const editor = page.getByRole('dialog',{name:'Edit solution'})
    assert.equal(await editor.getByLabel(/^ID/).isDisabled(),true)
    await editor.getByLabel('Name',{exact:true}).fill('Haggling (edited)')
    await editor.getByLabel(/^Text/).fill('Edited fixture text.')
    await editor.getByRole('button',{name:'Save changes'}).click()
    await page.getByRole('dialog',{name:'Haggling (edited)'}).waitFor()
    const solutions = await read('solutions')
    assert.equal(solutions['10002'].mSolutionName,'Haggling (edited)')
    assert.equal(solutions['10002'].mSolutionText,'Edited fixture text.')
    assert.equal(solutions['10002'].mSolutionType,3)
    assert.equal(solutions['10001'].mSolutionName,'Arcane Intellect')
  })
})

test('expansion, frame and portrait editors persist their legacy data structures', async () => {
  await withPage(async page => {
    await page.getByRole('button',{name:'Expansions',exact:true}).click()
    await page.getByRole('button',{name:'Add expansion',exact:true}).click()
    let dialog = page.getByRole('dialog',{name:'Add expansion'})
    await dialog.getByLabel('ID',{exact:true}).fill('49125')
    await dialog.getByLabel('Name',{exact:true}).fill('Browser fixture expansion')
    await dialog.getByRole('button',{name:'Save expansion'}).click()
    await waitStatus(page,'Expansion saved.')
    assert.equal((await read('expansions')).expansions['49125'].mExtensioName,'Browser fixture expansion')

    await page.getByRole('button',{name:'Frames',exact:true}).click()
    await page.getByRole('button',{name:'Add frame',exact:true}).click()
    dialog = page.getByRole('dialog',{name:'Add frame'})
    await dialog.getByLabel('Frame ID').fill('925')
    await dialog.getByRole('button',{name:'Save frame #925'}).click()
    await waitStatus(page,'Frame saved.')
    assert.equal((await read('frames')).Frames[925].frameID,925)

    await page.getByRole('button',{name:'Portraits',exact:true}).click()
    await page.getByRole('button',{name:'Add portrait',exact:true}).click()
    dialog = page.getByRole('dialog',{name:'Add portrait'})
    await dialog.getByLabel('Avatar ID').fill('926')
    await dialog.getByLabel('Avatar name').fill('Browser fixture portrait')
    await dialog.getByRole('button',{name:'Save portrait'}).click()
    await waitStatus(page,'Portrait saved.')
    assert.equal((await read('portraits')).Avatar[926].avatarName,'Browser fixture portrait')
  })
})

test('expansion, frame and portrait detail panels open an editor for that entry', async () => {
  await withPage(async page => {
    const expansions = (await read('expansions')).expansions
    const expansionKey = Object.keys(expansions).find(key => key !== '49125')
    await page.goto(base + '/content/expansions/' + expansionKey)
    await page.getByRole('dialog',{name:expansions[expansionKey].mExtensioName}).getByRole('button',{name:'Edit',exact:true}).click()
    let editor = page.getByRole('dialog',{name:'Edit expansion'})
    await editor.getByLabel('Gem cost').fill('77')
    await editor.getByRole('button',{name:'Save changes'}).click()
    await waitStatus(page,'Expansion saved.')
    assert.equal((await read('expansions')).expansions[expansionKey].mExtensioCost,77)

    const frame = (await read('frames')).Frames.find(row => row && row.frameID !== 925)
    await page.goto(base + '/content/frames/' + frame.frameID)
    await page.getByRole('dialog',{name:'Frame ' + frame.frameID}).getByRole('button',{name:'Edit',exact:true}).click()
    editor = page.getByRole('dialog',{name:'Edit frame'})
    await editor.getByLabel('Gem cost').fill('12')
    await editor.getByRole('button',{name:'Save changes'}).click()
    await waitStatus(page,'Frame saved.')
    assert.equal((await read('frames')).Frames[frame.frameID].frameGem,12)

    const portrait = (await read('portraits')).Avatar.find(row => row && row.avatarID !== 926)
    await page.goto(base + '/content/portraits/' + portrait.avatarID)
    await page.getByRole('dialog',{name:portrait.avatarName}).getByRole('button',{name:'Edit',exact:true}).click()
    editor = page.getByRole('dialog',{name:'Edit portrait'})
    await editor.getByLabel('Avatar name').fill('Edited fixture portrait')
    await editor.getByRole('button',{name:'Save changes'}).click()
    await waitStatus(page,'Portrait saved.')
    assert.equal((await read('portraits')).Avatar[portrait.avatarID].avatarName,'Edited fixture portrait')
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
    await page.getByRole('button',{name:'Add frame',exact:true}).click()
    const dialog = page.getByRole('dialog',{name:'Add frame'})
    await dialog.getByLabel('Frame ID').fill('927')
    await dialog.getByRole('button',{name:'Save frame #927'}).click()
    await dialog.getByRole('alert').getByText('Simulated fixture storage error').waitFor()
    assert.equal(JSON.stringify(await read('frames')),original)
  })
})

test('a pinned legacy Morkahja WebP asset decodes in Chromium', async () => {
  await withPage(async page => {
    const result = await page.evaluate(async () => {
      const response = await fetch('/game/solutionimages/legacy_sample.webp')
      if (!response.ok) return { ok:false, status:response.status }
      const bitmap = await createImageBitmap(await response.blob())
      const dimensions = {ok:true, width:bitmap.width, height:bitmap.height}
      bitmap.close()
      return dimensions
    })
    assert.equal(result.ok, true)
    assert.ok(result.width > 0 && result.height > 0)
  })
})

test('single Connection screen creates an owner administrator without exposing secrets', async () => {
  await withPage(async page => {
    await page.goto(base + '/connections')
    await page.getByRole('heading', { name: 'Connection', exact: true }).waitFor()
    await page.getByRole('textbox', { name: 'Connection name' }).fill('Browser owner connection')
    await page.getByRole('textbox', { name: 'Server host' }).fill('fixture.example.invalid')
    await page.getByRole('button', { name: 'Save connection' }).click()
    await page.getByRole('heading', { name: 'Browser owner connection' }).waitFor()
    await page.getByRole('region', { name: 'Morkahja administrator connection' })
      .getByText('fixture.example.invalid', { exact: true }).waitFor()
    await page.getByText('Credential', { exact: true }).waitFor()
  })
})
