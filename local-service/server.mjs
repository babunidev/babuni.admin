import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { inspectContent } from './inspectContent.mjs'
import { probeProfile, inspectionState } from './connectionHealth.mjs'
import { connectLocal, disconnectLocal } from './connectionLifecycle.mjs'
import { preflightSshHost } from './sshHostPreflight.mjs'
import { probeMorkahjaPostgres, isSshProbeActive, fetchMorkahjaReadOnly } from './sshPostgresProbe.mjs'
import { stopAllSshTunnels } from './sshTunnel.mjs'
import { parsePlayerPage } from './morkahjaReadOnly.mjs'
import { credentialStatus, keyringHealth, clearCredential, requiresCredential } from './keyring.mjs'
import { hasCapability, specForProfile } from '../vite/connectionAdapters.ts'
import { LocalConnectionRegistry } from '../vite/localConnectionRegistry.ts'

const PORT = Number(process.env.BABUNI_LOCAL_SERVICE_PORT || '5191')
const TOKEN = process.env.BABUNI_LOCAL_SERVICE_TOKEN
const UI_PORT = Number(process.env.BABUNI_UI_PORT || '5180')
if (!TOKEN || TOKEN.length < 32 || !Number.isInteger(PORT) || PORT < 1024 || PORT > 65535 ||
  !Number.isInteger(UI_PORT) || UI_PORT < 1024 || UI_PORT > 65535) {
  throw new Error('Local service requires a strong ephemeral token and valid ports')
}
const registry = new LocalConnectionRegistry(process.env.BABUNI_TEST_PROFILE_FILE)
const states = new Map()
function send(res, code, data) {
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'})
  res.end(JSON.stringify(data))
}
function validKey(supplied) {
  if (typeof supplied !== 'string') return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(TOKEN)
  return a.length === b.length && timingSafeEqual(a,b)
}
async function body(req) {
  let content = ''
  for await (const part of req) {
    content += part.toString('utf8')
    if (Buffer.byteLength(content)>4096) throw Object.assign(new Error('TOO_LARGE'),{status:413})
  }
  try { return JSON.parse(content) } catch { throw Object.assign(new Error('INVALID_JSON'),{status:400}) }
}
async function listedProfile(profile) {
  const last=states.get(profile.id) || {
    state:'not-configured',code:'NOT_CHECKED',detail:'No connection test performed.',
  }
  const credential=requiresCredential(profile) ? await credentialStatus(profile) : 'not-required'
  const adapter=specForProfile(profile)
  return {...profile,...last,credential,capabilities:adapter?.capabilities || []}
}
const server=createServer(async(req,res)=>{
  const peer=req.socket.remoteAddress
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)) return send(res,403,{error:'LOCAL_ONLY'})
  if (!['127.0.0.1:'+PORT,'localhost:'+PORT].includes(req.headers.host)) {
    return send(res,403,{error:'HOST_DENIED'})
  }
  if (!validKey(req.headers['x-babuni-service-key']) || req.headers['x-babuni-local']!=='1') {
    return send(res,403,{error:'ACCESS_DENIED'})
  }
  if (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site'])) {
    return send(res,403,{error:'CROSS_SITE_DENIED'})
  }
  const origin=req.headers.origin
  if (origin) {
    try {
      const parsed=new URL(origin)
      const allowed=parsed.protocol==='http:' && ['127.0.0.1','localhost'].includes(parsed.hostname) &&
        parsed.port===String(UI_PORT) && parsed.pathname==='/' && !parsed.username && !parsed.password
      if (!allowed) return send(res,403,{error:'ORIGIN_DENIED'})
    } catch { return send(res,403,{error:'ORIGIN_DENIED'}) }
  }
  if (!['GET','HEAD'].includes(req.method) && !origin) return send(res,403,{error:'ORIGIN_REQUIRED'})
  try {
    const path=new URL(req.url || '/', 'http://127.0.0.1').pathname.replace(/^\/local-connections-api/,'') || '/'
    if (req.method==='GET' && path==='/health') return send(res,200,{
      ok:true,service:'available',mode:'local-only',
      keyring:await keyringHealth(),checkedAt:new Date().toISOString(),
    })
    if (req.method==='GET' && path==='/') return send(res,200,{
      profiles:await Promise.all(registry.list().map(listedProfile)),
    })
    if (req.method==='POST' && path==='/') {
      const profile=registry.add(await body(req))
      return send(res,201,{profile})
    }
    const match=/^\/([0-9a-f-]{36})(?:\/(test|inspect|connect|disconnect|reconnect|probe|read-overview|read-players|read-dashboard))?$/i.exec(path)
    if (!match) return send(res,404,{error:'NOT_FOUND'})
    const id=match[1]
    const action=match[2]
    const profile=registry.list().find(p=>p.id===id)
    if (!profile) return send(res,404,{error:'NOT_FOUND'})

    if (['PUT','DELETE'].includes(req.method) && !action &&
        profile.kind==='postgres-ssh' && isSshProbeActive()) return send(res,409,{error:'REMOTE_PROBE_BUSY'})
    if (req.method==='PUT' && !action) {
      const previous=profile.target
      const updated=registry.update(id,await body(req))
      if (previous!==updated.target) states.delete(id)
      return send(res,200,{profile:await listedProfile(updated)})
    }
    if (req.method==='DELETE' && !action) {
      if (requiresCredential(profile)) {
        try { await clearCredential(profile) }
        catch { return send(res,503,{error:'KEYRING_UNAVAILABLE'}) }
      }
      const ok=registry.remove(id)
      if (ok) states.delete(id)
      return send(res,ok?200:404,{ok})
    }
    if (req.method==='POST' && action==='test') {
      const previous=states.get(id) || {}
      const result=hasCapability(profile,'ssh:preflight')
        ? await preflightSshHost(profile) : await probeProfile(profile,previous)
      const status=previous.state==='connected' && result.state==='available'
        ? {...result,state:'connected',code:'LOCAL_READ_ONLY_CONNECTED'} : result
      states.set(id,status)
      return send(res,200,{status})
    }
    if (req.method==='POST' && action==='probe') {
      if (!hasCapability(profile,'ssh:probe')) return send(res,403,{error:'CAPABILITY_DENIED'})
      const status=await probeMorkahjaPostgres(profile)
      states.set(id,status)
      return send(res,200,{status})
    }
    if (req.method==='POST' && ['read-overview','read-players','read-dashboard'].includes(action)) {
      if (!hasCapability(profile,'ssh:read')) return send(res,403,{error:'CAPABILITY_DENIED'})
      let page=1
      if(action==='read-players') {
        try {page=parsePlayerPage(await body(req))}
        catch {return send(res,400,{error:'INVALID_PAGE'})}
      }
      const kind=action==='read-overview'?'overview':action==='read-dashboard'?'dashboard':'players'
      const report=await fetchMorkahjaReadOnly(profile,kind,page)
      if(!report.ok) {
        const code=report.code==='REMOTE_PROBE_BUSY'?409:
          ['REMOTE_PROBE_DISABLED','REMOTE_READ_DISABLED','REMOTE_SCOPE_DENIED'].includes(report.code)?403:422
        return send(res,code,{error:report.code})
      }
      states.set(id,{
        state:'disconnected',code:'REMOTE_READ_COMPLETED',
        detail:'Approved read-only snapshot retrieved; SSH tunnel closed.',
        checkedAt:report.checkedAt,lastSuccessAt:report.checkedAt,
      })
      return send(res,200,report)
    }
    if (req.method==='GET' && action==='inspect') {
      if (!hasCapability(profile,'local:inspect')) return send(res,403,{error:'CAPABILITY_DENIED'})
      const report=await inspectContent(profile)
      const status=inspectionState(report,states.get(id))
      if (states.get(id)?.state==='connected' && status.state==='available') {
        states.set(id,{...status,state:'connected',code:'LOCAL_READ_ONLY_CONNECTED'})
      } else states.set(id,status)
      return send(res,report.ok?200:422,report)
    }
    if (req.method==='POST' && ['connect','reconnect','disconnect'].includes(action)) {
      if (!hasCapability(profile,'local:connect')) return send(res,409,{error:'ADAPTER_NOT_IMPLEMENTED'})
      if (action==='reconnect' && !states.has(id)) return send(res,409,{error:'NOT_PREVIOUSLY_CHECKED'})
      if (action==='disconnect') {
        const result=disconnectLocal(profile)
        states.set(id,result.status)
        return send(res,200,result)
      }
      const result=await connectLocal(profile,states.get(id))
      if (result.status) states.set(id,result.status)
      return send(res,result.ok?200:422,result)
    }
    return send(res,404,{error:'NOT_FOUND'})
  } catch(error) {
    const message=error instanceof Error ? error.message : 'UNKNOWN'
    const status=error.status===413?413:
      ['INVALID_JSON','INVALID_PROFILE','UNKNOWN_FIELDS'].includes(message)?400:500
    return send(res,status,{error:status===500?'LOCAL_SERVICE_FAILURE':message})
  }
})
server.on('error',error=>{console.error('Local service could not bind to loopback:',error.code||error.message);process.exitCode=1})
server.listen(PORT,'127.0.0.1',()=>console.log('Local profile service ready on loopback (remote probe disabled by default).'))
const close=()=>{void stopAllSshTunnels().finally(()=>server.close(()=>process.exit(0)))}
process.on('SIGTERM',close)
process.on('SIGINT',close)
