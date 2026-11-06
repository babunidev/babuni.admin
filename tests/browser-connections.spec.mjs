import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {chromium} from 'playwright'
import {request as httpRequest} from 'node:http'

const origin=process.env.BROWSER_TEST_BASE_URL||'http://127.0.0.1:5185'
const gameRoot=process.env.BABUNI_BROWSER_TEST_GAME_ROOT
function requestWithHost(url,headers) {
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

test('Connection creates one owner administrator with visible status and editable server target',async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.goto(origin+'/connections')
    await page.getByRole('heading',{name:'Connection',exact:true}).waitFor()
    await page.getByText('Local service: Running on this PC',{exact:false}).waitFor()
    await page.getByRole('textbox',{name:'Connection name'}).fill('Owner test connection')
    await page.getByRole('textbox',{name:'Server host'}).fill('fixture.example.invalid')
    await page.getByRole('button',{name:'Save connection'}).click()
    await page.getByRole('heading',{name:'Owner test connection'}).waitFor()
    await page.getByText('fixture.example.invalid',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Check SSH host'}).click()
    await page.getByText('SSH_HOST_KEY_PINNED_OFFLINE',{exact:false}).waitFor()
    await page.getByRole('button',{name:'Edit server details'}).click()
    const editor=page.getByRole('form',{name:'Edit administrator connection'})
    await editor.getByRole('textbox',{name:'Connection name'}).fill('Owner connection renamed')
    await editor.getByRole('button',{name:'Save changes'}).click()
    await page.getByRole('heading',{name:'Owner connection renamed'}).waitFor()
    const saved=await page.evaluate(()=>localStorage.getItem('babuni-admin:morkahja:moderation-profile'))
    assert.match(saved,/^[0-9a-f-]{36}$/i)
    assert.deepEqual(errors,[])
  }finally{await context.close()}
})

test('Overview automatically loads the one administrator; no per-page profile picker',async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  try {
    await page.goto(origin+'/')
    await page.getByRole('heading',{name:'Morkahja — Overview'}).waitFor()
    await page.getByRole('status').getByText('REMOTE_MODERATION_DISABLED',{exact:false}).waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Authorized Morkahja connection'}).count(),0)
    assert.equal(await page.getByRole('button',{name:'Refresh overview and players'}).isDisabled(),false)
    await page.goto(origin+'/players')
    await page.getByRole('heading',{name:'Moderation'}).waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Morkahja administrator connection'}).count(),0)
    await page.goto(origin+'/content')
    await page.getByRole('heading',{name:'Content'}).waitFor()
    assert.equal(await page.getByRole('combobox',{name:'Morkahja administrator connection'}).count(),0)
    assert.deepEqual(errors,[])
  }finally{await context.close()}
})

test('Overview renders aggregates automatically, retains real zeros and never polls',async()=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage()
  let reads=0
  let metrics={achievementsUnlocked:3,playersWithAchievements:2,diceUnlocks:0,expansionUnlocks:4}
  try {
    await page.route('**/local-connections-api/**',async route=>{
      const path=new URL(route.request().url()).pathname
      let response
      if(path.endsWith('/session'))response={session:'fixture-session-'.repeat(4)}
      else if(path.endsWith('/read-dashboard')) {
        reads++
        response={ok:true,checkedAt:'2026-11-05T12:00:00Z',data:{
          overview:{players:4,avatars:6,activeSessions:1,eventsLast24h:2,...metrics},
          playerPage:{page:1,pageSize:20,total:0,players:[]},
        }}
      }else response={profiles:[{id:'fixture',projectId:'morkahja',
        kind:'postgres-ssh-moderation',displayName:'Admin fixture',
        target:'fixture.example.invalid'}]}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)})
    })
    await page.goto(origin+'/')
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
    assert.deepEqual(stored,[['babuni-admin:morkahja:moderation-profile','fixture']])
  }finally{await context.close()}
})
