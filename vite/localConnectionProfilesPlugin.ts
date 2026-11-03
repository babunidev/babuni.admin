import type { Plugin } from 'vite'
import { LocalConnectionRegistry } from './localConnectionRegistry'
import { readLimitedBody, rejectNonLocalRequest } from './localRequestGuard'

export function localConnectionProfilesPlugin(
  registry: LocalConnectionRegistry = new LocalConnectionRegistry(),
): Plugin {
  return {
    name: 'babuni-local-connection-profiles',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-connections-api', (req, res) => {
        if (rejectNonLocalRequest(req, res)) return
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        const send = (status: number, data: unknown) => {
          res.statusCode = status
          res.end(JSON.stringify(data))
        }
        // JSON mutations require a non-simple request header; cross-site forms cannot supply it.
        if (req.method !== 'GET' && req.headers['x-babuni-local'] !== '1') {
          send(403, { error: 'LOCAL_REQUEST_HEADER_REQUIRED' })
          return
        }
        void (async () => {
          try {
            const pathname = new URL(req.url || '/', 'http://localhost').pathname
            if (req.method === 'GET' && pathname === '/') return send(200, { profiles: registry.list() })
            if (req.method === 'POST' && pathname === '/') {
              const data = JSON.parse(await readLimitedBody(req, 4096)) as unknown
              return send(201, { profile: registry.add(data) })
            }
            if (req.method === 'DELETE' && /^\/[0-9a-f-]{36}$/i.test(pathname)) {
              const removed = registry.remove(pathname.slice(1))
              return send(removed ? 200 : 404, { ok: removed })
            }
            return send(404, { error: 'NOT_FOUND' })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'LOCAL_PROFILE_ERROR'
            const status = (error as {status?:number})?.status === 413 ? 413 :
              message === 'INVALID_PROFILE' || message === 'UNKNOWN_FIELDS' || error instanceof SyntaxError ? 400 : 500
            return send(status, { error: status === 500 ? 'LOCAL_PROFILE_ERROR' : message })
          }
        })()
      })
    },
  }
}
