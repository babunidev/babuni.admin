import type { IncomingMessage, ServerResponse } from 'node:http'

/** Defense in depth for local Vite middleware; not a replacement for authentication. */
export function rejectNonLocalRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const hostHeader = (req.headers.host ?? '').toLowerCase()
  const host = hostHeader.startsWith('[') ? hostHeader.split(']')[0] + ']' : hostHeader.split(':')[0]
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  const remote = req.socket.remoteAddress
  const localPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote ?? '')
  const origin = req.headers.origin
  let sameOrigin = true
  if (origin) {
    try {
      const parsed = new URL(origin)
      sameOrigin = ['http:', 'https:'].includes(parsed.protocol) && parsed.host.toLowerCase() === hostHeader
    } catch { sameOrigin = false }
  }
  if (!localHost || !localPeer || !sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
    res.statusCode = 403
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'LOCAL_ONLY' }))
    return true
  }
  return false
}

export function readLimitedBody(req: IncomingMessage, maxBytes = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let rejected = false
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes && !rejected) {
        rejected = true
        reject(Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 }))
      }
      if (!rejected) chunks.push(chunk)
    })
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks).toString('utf8')) })
    req.on('error', reject)
  })
}
