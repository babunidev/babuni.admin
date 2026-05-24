import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

import {
  banPlayerInPostgres,
  getDashboardFromPostgres,
  getPostgresServerStatus,
  listActivityFromPostgres,
  listOnlinePlayersFromPostgres,
  getPlayerDetailFromPostgres,
  listPlayersFromPostgres,
  timeoutPlayerInPostgres,
  unbanPlayerInPostgres,
} from './postgresAdmin'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

export function morkahjaLocalAdminPlugin(connectionString: string): Plugin {
  const apiPrefix = '/local-admin-api'

  return {
    name: 'morkahja-local-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(apiPrefix)) {
          next()
          return
        }

        const route = url.slice(apiPrefix.length).split('?')[0] ?? ''
        const segment = route.replace(/^\//, '')

        void (async () => {
          try {
            if (req.method === 'GET' && segment === 'health') {
              try {
                const { listPlayersFromPostgres } = await import('./postgresAdmin')
                await listPlayersFromPostgres(connectionString)
                sendJson(res, 200, { ok: true })
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'LOCAL_ADMIN_ERROR'
                sendJson(res, 503, { ok: false, error: message })
              }
              return
            }

            if (req.method === 'GET' && segment === 'server') {
              sendJson(res, 200, getPostgresServerStatus())
              return
            }

            if (req.method === 'GET' && segment === 'dashboard') {
              sendJson(res, 200, await getDashboardFromPostgres(connectionString))
              return
            }

            if (req.method === 'GET' && segment === 'players') {
              sendJson(res, 200, await listPlayersFromPostgres(connectionString))
              return
            }

            if (req.method === 'GET' && segment === 'players/online') {
              sendJson(res, 200, await listOnlinePlayersFromPostgres(connectionString))
              return
            }

            if (
              req.method === 'GET' &&
              segment.startsWith('players/') &&
              segment !== 'players/online'
            ) {
              const playerId = decodeURIComponent(segment.slice('players/'.length))
              const detail = await getPlayerDetailFromPostgres(
                connectionString,
                playerId,
              )
              if (!detail) {
                sendJson(res, 404, { error: 'PLAYER_NOT_FOUND' })
                return
              }
              sendJson(res, 200, detail)
              return
            }

            if (req.method === 'GET' && segment === 'activity') {
              sendJson(res, 200, await listActivityFromPostgres(connectionString))
              return
            }

            if (req.method === 'POST' && segment === 'players/timeout') {
              const body = JSON.parse(await readBody(req)) as {
                playerId?: string
                durationMinutes?: number
                reason?: string
              }
              if (!body.playerId || !body.durationMinutes) {
                sendJson(res, 400, { error: 'INVALID_BODY' })
                return
              }
              const result = await timeoutPlayerInPostgres(
                connectionString,
                body.playerId,
                body.durationMinutes,
                body.reason,
              )
              sendJson(res, 200, {
                ok: result.ok,
                playerId: body.playerId,
                message: result.message,
              })
              return
            }

            if (req.method === 'POST' && segment === 'players/ban') {
              const body = JSON.parse(await readBody(req)) as {
                playerId?: string
                reason?: string
              }
              if (!body.playerId) {
                sendJson(res, 400, { error: 'INVALID_BODY' })
                return
              }
              const result = await banPlayerInPostgres(
                connectionString,
                body.playerId,
                body.reason,
              )
              sendJson(res, 200, {
                ok: result.ok,
                playerId: body.playerId,
                message: result.message,
              })
              return
            }

            if (req.method === 'POST' && segment === 'players/unban') {
              const body = JSON.parse(await readBody(req)) as { playerId?: string }
              if (!body.playerId) {
                sendJson(res, 400, { error: 'INVALID_BODY' })
                return
              }
              const result = await unbanPlayerInPostgres(
                connectionString,
                body.playerId,
              )
              sendJson(res, 200, {
                ok: result.ok,
                playerId: body.playerId,
                message: result.message,
              })
              return
            }

            sendJson(res, 404, { error: 'NOT_FOUND' })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'LOCAL_ADMIN_ERROR'
            sendJson(res, 500, { error: message })
          }
        })()
      })
    },
  }
}
