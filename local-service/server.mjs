import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { stat, realpath } from 'node:fs/promises'
import { inspectContent } from './inspectContent.mjs'
import { LocalConnectionRegistry } from '../vite/localConnectionRegistry.ts'

const PORT = Number(process.env.BABUNI_LOCAL_SERVICE_PORT || '5191')
const TOKEN = process.env.BABUNI_LOCAL_SERVICE_TOKEN
if (!TOKEN || TOKEN.length < 32 || !Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error('Local service requires a strong ephemeral token and valid port')
}
const registry = new LocalConnectionRegistry(process.env.BABUNI_TEST_PROFILE_FILE)
const states = new Map()
const send = (res, code, data) => {
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'})
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
    if (Buffer.byteLength(content)>4096) throw Object.assign(new Error('TOO_LARGE'), {status:413})
  }
  try { return JSON.parse(content) } catch { throw Object.assign(new Error('INVALID_JSON'), {status:400}) }
}
async function probe(profile) {
  if (profile.kind !== 'local-files') return {state:'not-configured',detail:'This connection type is not implemented yet.'}
  try {
    const target = await realpath(profile.target)
    const result = await stat(target)
    if (!result.isDirectory()) return {state:'error',detail:'Target is not a directory.'}
    return {state:'available',detail:'Directory exists and can be inspected locally. No files were modified.',checkedAt:new Date().toISOString()}
  } catch {
    return {state:'error',detail:'Local directory does not exist or cannot be accessed.',checkedAt:new Date().toISOString()}
  }
}
const server = createServer(async (req,res) => {
  const peer = req.socket.remoteAddress
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)) return send(res,403,{error:'LOCAL_ONLY'})
  if (!validKey(req.headers['x-babuni-service-key']) || req.headers['x-babuni-local'] !== '1') return send(res,403,{error:'ACCESS_DENIED'})
  if (req.headers['sec-fetch-site'] === 'cross-site') return send(res,403,{error:'CROSS_SITE_DENIED'})
  const origin = req.headers.origin
  if (origin) {
    try {
      const parsed = new URL(origin)
      const allowed = parsed.protocol==='http:' && ['127.0.0.1','localhost'].includes(parsed.hostname) &&
        parsed.port === String(process.env.BABUNI_UI_PORT || 5180)
      if (!allowed) return send(res,403,{error:'ORIGIN_DENIED'})
    } catch { return send(res,403,{error:'ORIGIN_DENIED'}) }
  }
  try {
    const path = new URL(req.url || '/', 'http://127.0.0.1').pathname.replace(/^\/local-connections-api/, '') || '/'
    if (req.method === 'GET' && path === '/') {
      const profiles = registry.list().map(p=>({...p,...(states.get(p.id) || {state:'not-configured',detail:'No connection test performed.'})}))
      return send(res,200,{profiles})
    }
    if (req.method === 'POST' && path === '/') {
      const profile=registry.add(await body(req))
      return send(res,201,{profile})
    }
    const match = /^\/([0-9a-f-]{36})(?:\/(test|inspect))?$/i.exec(path)
    if (match && req.method === 'DELETE' && !match[2]) {
      states.delete(match[1])
      const ok=registry.remove(match[1])
      return send(res,ok?200:404,{ok})
    }
    if (match && req.method === 'POST' && match[2]==='test') {
      const profile=registry.list().find(p=>p.id===match[1])
      if (!profile) return send(res,404,{error:'NOT_FOUND'})
      const status=await probe(profile)
      states.set(profile.id,status)
      return send(res,200,{status})
    }
    if (match && req.method === 'GET' && match[2] === 'inspect') {
      const profile = registry.list().find(p=>p.id===match[1])
      if (!profile) return send(res,404,{error:'NOT_FOUND'})
      const report = await inspectContent(profile)
      return send(res, report.ok ? 200 : 422, report)
    }
    return send(res,404,{error:'NOT_FOUND'})
  } catch(error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN'
    const status = error.status === 413 ? 413 :
      ['INVALID_JSON','INVALID_PROFILE','UNKNOWN_FIELDS'].includes(message) ? 400 : 500
    return send(res,status,{error:status===500?'LOCAL_SERVICE_FAILURE':message})
  }
})
server.on('error', err => { console.error('Local service could not bind to loopback:',err.code||err.message);process.exitCode=1 })
server.listen(PORT,'127.0.0.1',()=>console.log('Local profile service ready on loopback (no remote access).'))
const close = ()=>server.close(()=>process.exit(0))
process.on('SIGTERM',close)
process.on('SIGINT',close)
