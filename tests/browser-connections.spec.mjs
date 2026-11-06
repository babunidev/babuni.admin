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
    await page.getByText('Result: DISCONNECTED',{exact:false}).waitFor()
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


test('Overview restores selected profile and blocks unapproved automatic reads',async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.goto(origin+'/connections')
    await page.getByRole('heading',{name:'Connections'}).waitFor()
    await page.getByRole('combobox',{name:'Connection type'}).selectOption('postgres-ssh')
    await page.getByRole('textbox',{name:'Profile name'}).fill('Read-only fixture')
    await page.getByRole('textbox',{name:'Target (no credentials)'}).fill('fixture.example.invalid')
    await page.getByRole('button',{name:'Save profile'}).click()
    await page.getByRole('heading',{name:'Read-only fixture'}).waitFor()

    await page.goto(origin+'/')
    await page.getByRole('heading',{name:'Morkahja — Overview'}).waitFor()
    await page.getByText('Select a saved SSH profile below to load the overview and players.').waitFor()
    await page.getByRole('navigation',{name:'Morkahja navigation'})
      .getByRole('link',{name:'Moderation'}).waitFor()
    assert.equal(await page.getByRole('table').count(),0)
    assert.equal(await page.getByRole('button',{name:'Load database overview'}).count(),0)
    assert.equal(await page.getByRole('button',{name:'Load player preview'}).count(),0)

    const selector=page.getByRole('combobox',{name:'Authorized Morkahja connection'})
    await selector.selectOption({label:'Read-only fixture · fixture.example.invalid'})
    await page.getByRole('status').getByText('REMOTE_PROBE_DISABLED').waitFor()
    const selected=await selector.inputValue()
    assert.match(selected,/^[0-9a-f-]{36}$/i)
    const saved=await page.evaluate(()=>
      localStorage.getItem('babuni-admin:morkahja:overview-profile'))
    assert.equal(saved,selected)
    assert.equal(await page.getByRole('table').count(),0)

    await page.reload()
    await page.getByRole('heading',{name:'Morkahja — Overview'}).waitFor()
    await page.getByRole('status').getByText('REMOTE_PROBE_DISABLED').waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Authorized Morkahja connection'}).inputValue(),selected)
    await page.getByRole('button',{name:'Refresh overview and players'}).click()
    await page.getByRole('status').getByText('REMOTE_PROBE_DISABLED').waitFor()

    await page.getByRole('combobox',{name:'Authorized Morkahja connection'}).selectOption('')
    const cleared=await page.evaluate(()=>
      localStorage.getItem('babuni-admin:morkahja:overview-profile'))
    assert.equal(cleared,null)
    assert.deepEqual(errors,[])
  }finally{
    await context.close()
  }
})

test('Overview renders aggregate totals, real zeros and unavailable values without background polling',async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage()
  let reads=0
  let metrics={achievementsUnlocked:3,playersWithAchievements:2,diceUnlocks:0,expansionUnlocks:4}
  try {
    await page.route('**/local-connections-api/**',async route=>{
      const path=new URL(route.request().url()).pathname
      let body
      if(path.endsWith('/session')) body={session:'fixture-session-'.repeat(4)}
      else if(path.endsWith('/read-dashboard')) {
        reads++
        body={ok:true,checkedAt:'2026-11-05T12:00:00Z',data:{
          overview:{players:4,avatars:6,activeSessions:1,eventsLast24h:2,...metrics},
          playerPage:{page:1,pageSize:20,total:0,players:[]},
        }}
      } else body={profiles:[{id:'fixture',projectId:'morkahja',kind:'postgres-ssh',
        displayName:'Aggregate fixture',target:'fixture.example.invalid'}]}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
    })
    await page.goto(origin+'/')
    await page.getByRole('combobox',{name:'Authorized Morkahja connection'})
      .selectOption('fixture')
    const cards=page.getByLabel('Achievements and ownership')
    await cards.getByText('Achievements unlocked',{exact:true}).waitFor()
    const card=label=>cards.locator('article').filter({has:page.getByText(label,{exact:true})})
    assert.equal(await card('Achievements unlocked').locator('p').nth(1).textContent(),'3')
    assert.equal(await card('Players with achievements').locator('p').nth(1).textContent(),'2')
    assert.equal(await card('Dice unlocks').locator('p').nth(1).textContent(),'0')
    assert.equal(await card('Expansion unlocks').locator('p').nth(1).textContent(),'4')
    metrics={achievementsUnlocked:null,playersWithAchievements:null,diceUnlocks:-1,expansionUnlocks:'0'}
    await page.getByRole('button',{name:'Refresh overview and players'}).click()
    await card('Dice unlocks').getByText('Unavailable',{exact:true}).waitFor()
    assert.equal(await cards.getByText('Unavailable',{exact:true}).count(),4)
    const settledReads=reads
    await page.waitForTimeout(1200)
    assert.equal(reads,settledReads)
    const stored=await page.evaluate(()=>Object.entries(localStorage))
    assert.deepEqual(stored,[['babuni-admin:morkahja:overview-profile','fixture']])
  } finally {await context.close()}
})
