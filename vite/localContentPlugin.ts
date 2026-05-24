import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { resolveEncounterImageBase } from './encounterImageNaming'

const JSON_FILES = {
  encounters: 'encountersdata.json',
  solutions: 'solutiondata.json',
  expansions: 'expansiondata.json',
  frames: 'frames.json',
  portraits: 'portraits.json',
} as const

type ContentKind = keyof typeof JSON_FILES

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function contentType(filePath: string): string {
  if (filePath.endsWith('.webp')) return 'image/webp'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

function safeResolve(root: string, urlPath: string): string | null {
  const target = normalize(join(root, urlPath.replace(/^\/+/, '')))
  const relative = target.slice(root.length)
  if (relative.startsWith('..') || target === root) return null
  return target
}

function serveStatic(
  root: string,
  mount: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const url = req.url ?? '/'
    if (!url.startsWith(mount)) {
      next()
      return
    }

    const relative = url.slice(mount.length) || '/'
    const filePath = safeResolve(root, relative === '/' ? 'index.html' : relative)

    if (!filePath || !existsSync(filePath)) {
      next()
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', contentType(filePath))
    createReadStream(filePath).pipe(res)
  }
}

function readJsonFile<T>(gameDir: string, kind: ContentKind): T {
  const filePath = join(gameDir, JSON_FILES[kind])
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

function writeJsonFile(gameDir: string, kind: ContentKind, data: unknown): void {
  const filePath = join(gameDir, JSON_FILES[kind])
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function localContentApi(
  gameDir: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  const apiPrefix = '/local-content-api'

  return (req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith(apiPrefix)) {
      next()
      return
    }

    const route = url.slice(apiPrefix.length).split('?')[0] ?? ''
    const segment = route.replace(/^\//, '')

    void (async () => {
      try {
        if (req.method === 'GET' && segment === 'status') {
          sendJson(res, 200, {
            ok: true,
            gameDir,
            files: JSON_FILES,
          })
          return
        }

        if (req.method === 'GET' && segment in JSON_FILES) {
          const kind = segment as ContentKind
          sendJson(res, 200, readJsonFile(gameDir, kind))
          return
        }

        if (req.method === 'POST' && segment in JSON_FILES) {
          const kind = segment as ContentKind
          const body = JSON.parse(await readBody(req)) as Record<string, unknown>

          if (kind === 'encounters' || kind === 'solutions') {
            const key = body.key
            const data = body.data
            if (typeof key !== 'string' || !data || typeof data !== 'object') {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<Record<string, unknown>>(gameDir, kind)
            file[key] = data
            writeJsonFile(gameDir, kind, file)
            sendJson(res, 201, { ok: true, key })
            return
          }

          if (kind === 'expansions') {
            const key = body.key
            const data = body.data
            if (typeof key !== 'string' || !data || typeof data !== 'object') {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<{ expansions: Record<string, unknown> }>(
              gameDir,
              kind,
            )
            file.expansions[key] = data
            writeJsonFile(gameDir, kind, file)
            sendJson(res, 201, { ok: true, key })
            return
          }

          if (kind === 'frames') {
            const data = body as { frameID?: number }
            if (typeof data.frameID !== 'number') {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<{ Frames: Array<unknown | null> }>(
              gameDir,
              kind,
            )
            const nextFrames = [...file.Frames]
            nextFrames[data.frameID] = body
            writeJsonFile(gameDir, kind, { Frames: nextFrames })
            sendJson(res, 201, { ok: true, frameID: data.frameID })
            return
          }

          if (kind === 'portraits') {
            const data = body as { avatarID?: number }
            if (typeof data.avatarID !== 'number') {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<{ Avatar: Array<unknown | null> }>(
              gameDir,
              kind,
            )
            const nextAvatars = [...file.Avatar]
            nextAvatars[data.avatarID] = body
            writeJsonFile(gameDir, kind, { Avatar: nextAvatars })
            sendJson(res, 201, { ok: true, avatarID: data.avatarID })
            return
          }
        }

        if (req.method === 'POST' && segment === 'upload/encounter-image') {
          const body = JSON.parse(await readBody(req)) as {
            fileName?: string
            encounterTitle?: string
            encounterId?: number
            dataBase64?: string
          }
          if (!body.dataBase64) {
            sendJson(res, 400, { error: 'INVALID_BODY' })
            return
          }

          const dir = join(gameDir, 'encounterimages')
          mkdirSync(dir, { recursive: true })

          let imageName: string
          const title = body.encounterTitle?.trim()
          if (title) {
            const fallback =
              typeof body.encounterId === 'number' && body.encounterId > 0
                ? `encounter_${body.encounterId}`
                : 'encounter'
            imageName = resolveEncounterImageBase(dir, title, fallback)
          } else {
            const fileName = body.fileName?.trim()
            if (!fileName) {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            imageName = fileName.replace(/\.webp$/i, '')
          }

          const baseFile = `${imageName}.webp`
          writeFileSync(
            join(dir, baseFile),
            Buffer.from(body.dataBase64, 'base64'),
          )
          sendJson(res, 201, {
            ok: true,
            path: `encounterimages/${baseFile}`,
            imageName,
          })
          return
        }

        if (req.method === 'POST' && segment === 'upload/solution-image') {
          const body = JSON.parse(await readBody(req)) as {
            fileName?: string
            dataBase64?: string
          }
          const fileName = body.fileName?.trim()
          if (!fileName || !body.dataBase64) {
            sendJson(res, 400, { error: 'INVALID_BODY' })
            return
          }
          const base = fileName.endsWith('.webp') ? fileName : `${fileName}.webp`
          const dir = join(gameDir, 'solutionimages')
          mkdirSync(dir, { recursive: true })
          writeFileSync(join(dir, base), Buffer.from(body.dataBase64, 'base64'))
          sendJson(res, 201, { ok: true, path: `solutionimages/${base}` })
          return
        }

        sendJson(res, 404, { error: 'NOT_FOUND' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'LOCAL_API_ERROR'
        sendJson(res, 500, { error: message })
      }
    })()
  }
}

export function morkahjaLocalContentPlugin(publicRoot: string): Plugin {
  const gameDir = join(publicRoot, 'game')
  const uiDir = join(publicRoot, 'UI')

  return {
    name: 'morkahja-local-content',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(localContentApi(gameDir))
      server.middlewares.use(serveStatic(gameDir, '/game'))
      server.middlewares.use(serveStatic(uiDir, '/UI'))
    },
  }
}

export function resolveMorkahjaPublicRoot(env: Record<string, string>): string {
  const configured = env.VITE_MORKAHJA_PUBLIC?.trim()
  if (configured) return resolve(configured)

  return resolve('C:/Users/Babun/Documents/Morkahja/MorkahjaWebApp/client/public')
}
