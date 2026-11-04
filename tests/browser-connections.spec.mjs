import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { chromium } from 'playwright'
import { request as httpRequest } from 'node:http'

const origin=process.env.BROWSER_TEST_BASE_URL||'http://127.0.0.1:5185'
const gameRoot=process.env.BABUNI_BROWSER_TEST_GAME_ROOT
function requestWithHost(url, headers) {
  return new Promise((resolve,reject)=>{
    const req=httpRequest(url,{headers:{...headers,Host:'attacker.invalid'}},res=>{
      res.resume()
      res.on('end',()=>resolve(res.statusCode))
    })
    req.on('error',reject)
    req.end()
  })
}
let browser

before(async()=>{
  assert.ok(gameRoot,'Use a disposable game directory for this test')
  assert.equal((await fetch(origin)).status,200)
  browser=await chromium.launch({headless:true})
})
after(async()=>{await browser?.close()})

test('browser session blocks untrusted connections requests',async()=>{
  const noSession=await fetch(origin+'/local-connections-api/',{
    headers:{'X-Babuni-Local':'1'},
  })
  assert.equal(noSession.status,403)
  const external=await fetch(origin+'/local-connections-api/session',{
    headers:{'X-Babuni-Local':'1',Origin:'http://attacker.invalid'},
  })
  assert.equal(external.status,403)
  const crossSite=await fetch(origin+'/local-connections-api/session',{
    headers:{'X-Babuni-Local':'1','Sec-Fetch-Site':'cross-site'},
  })
  assert.equal(crossSite.status,403)
  assert.equal(await requestWithHost(origin+'/local-connections-api/session',
    {'X-Babuni-Local':'1'}),403)
})

test('Connections UI creates edits checks connects disconnects and removes a local fixture profile',async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.goto(origin+'/connections')
    await page.getByRole('heading',{name:'Connections'}).waitFor()
    await page.getByText('Local service: Available (loopback only)',{exact:false}).waitFor()
    await page.getByRole('textbox',{name:'Profile name'}).fill('Fixture Morkahja')
    await page.getByRole('textbox',{name:'Target (no credentials)'}).fill(gameRoot)
    await page.getByRole('button',{name:'Save profile'}).click()
    await page.getByRole('heading',{name:'Fixture Morkahja'}).waitFor()
    await page.getByRole('button',{name:'Test'}).click()
    await page.getByText('DIRECTORY_AVAILABLE',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Connect',exact:true}).click()
    await page.getByText('LOCAL_READ_ONLY_CONNECTED',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Disconnect'}).click()
    await page.getByText('DISCONNECTED',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Reconnect'}).click()
    await page.getByText('Connected — local read-only session',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Inspect'}).click()
    await page.getByText('portraits.json:',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Edit'}).click()
    const editor=page.getByRole('form',{name:'Edit Fixture Morkahja'})
    await editor.getByRole('textbox',{name:'Profile name'}).fill('Renamed Morkahja')
    await editor.getByRole('button',{name:'Save changes'}).click()
    await page.getByRole('heading',{name:'Renamed Morkahja'}).waitFor()
    await page.getByRole('button',{name:'Remove'}).click()
    await page.getByText('No profiles configured.').waitFor()
    assert.deepEqual(errors,[])
  } finally {
    await context.close()
  }
})
