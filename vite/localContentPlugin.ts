import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  lstatSync,
} from 'node:fs'
import { join, resolve, relative, sep, isAbsolute } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { readLimitedBody, rejectNonLocalRequest } from './localRequestGuard'
import { resolveEncounterImageBase } from './encounterImageNaming'
import { writeFileWithBackup } from './atomicGameWrites'

const JSON_FILES = {
  encounters: 'encountersdata.json',
  solutions: 'solutiondata.json',
  expansions: 'expansiondata.json',
  frames: 'frames.json',
  portraits: 'portraits.json',
} as const

type ContentKind = keyof typeof JSON_FILES

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_RECORD_INDEX = 10_000

function validKey(key: unknown): key is string {
  return typeof key === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(key)
}

function validIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= MAX_RECORD_INDEX
}

function validImageName(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}(?:\\.webp)?$/i.test(value)
}

function decodeWebp(value: unknown): Buffer | null {
  if (typeof value !== 'string' ||
      value.length < 16 || value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8 ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(value)) return null
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES ||
      bytes.subarray(0, 4).toString() !== 'RIFF' ||
      bytes.subarray(8, 12).toString() !== 'WEBP' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length) return null
  return bytes
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
  try {
    // Resolve the canonical root and requested target to prevent traversal,
    // percent-encoded path escape and symlinks to files outside the project.
    const base = realpathSync(root)
    const decoded = decodeURIComponent(urlPath.split('?')[0])
    if (decoded.includes(String.fromCharCode(0))) return null
    const target = resolve(base, decoded.replace(/^\/+/, ''))
    const suffix = relative(base, target)
    if (!suffix || suffix === '..' || suffix.startsWith('..' + sep) || isAbsolute(suffix)) return null
    const info = lstatSync(target)
    if (!info.isFile() || info.isSymbolicLink()) return null
    const resolved = realpathSync(target)
    const actualSuffix = relative(base, resolved)
    if (!actualSuffix || actualSuffix === '..' || actualSuffix.startsWith('..' + sep)
        || isAbsolute(actualSuffix)) return null
    return target
  } catch {
    return null
  }
}

function serveStatic(
  root: string,
  mount: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const url = req.url ?? '/'
    if ((req.method !== 'GET' && req.method !== 'HEAD') ||
        (url !== mount && !url.startsWith(mount + '/'))) {
      next()
      return
    }

    const relative = url.slice(mount.length) || '/'
    const filePath = safeResolve(root, relative === '/' ? 'index.html' : relative)

    if (!filePath || !existsSync(filePath)) {
      next()
      return
    }

    if (rejectNonLocalRequest(req, res)) return
    res.statusCode = 200
    res.setHeader('Content-Type', contentType(filePath))
    const stream = createReadStream(filePath)
    stream.on('error', () => { if (!res.headersSent) { res.statusCode = 404; res.end() } else res.destroy() })
    stream.pipe(res)
  }
}

function readJsonFile<T>(gameDir: string, kind: ContentKind): T {
  const filePath = join(gameDir, JSON_FILES[kind])
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

function writeJsonFile(gameDir: string, kind: ContentKind, data: unknown): void {
  const filePath = join(gameDir, JSON_FILES[kind])
  writeFileWithBackup(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function localContentApi(
  dataDir: string,
  imageDir: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  const apiPrefix = '/local-content-api'

  return (req, res, next) => {
    const url = req.url ?? ''
    if (!url.startsWith(apiPrefix)) {
      next()
      return
    }

    if (rejectNonLocalRequest(req, res)) return

    const route = url.slice(apiPrefix.length).split('?')[0] ?? ''
    const segment = route.replace(/^\//, '')

    void (async () => {
      try {
        if (req.method === 'GET' && segment === 'status') {
          sendJson(res, 200, {
            ok: true,
            gameDir: dataDir,
            imageDir,
            files: JSON_FILES,
          })
          return
        }

        if (req.method === 'GET' && segment in JSON_FILES) {
          const kind = segment as ContentKind
          sendJson(res, 200, readJsonFile(dataDir, kind))
          return
        }

        if (req.method === 'POST' && segment in JSON_FILES) {
          const kind = segment as ContentKind
          const body = JSON.parse(await readLimitedBody(req)) as Record<string, unknown>
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            sendJson(res, 400, { error: 'INVALID_BODY' })
            return
          }

          if (kind === 'encounters' || kind === 'solutions') {
            const key = body.key
            const data = body.data
            if (!validKey(key) || !data || typeof data !== 'object' || Array.isArray(data)) {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<Record<string, unknown>>(dataDir, kind)
            file[key] = data
            writeJsonFile(dataDir, kind, file)
            sendJson(res, 201, { ok: true, key })
            return
          }

          if (kind === 'expansions') {
            const key = body.key
            const data = body.data
            if (!validKey(key) || !data || typeof data !== 'object' || Array.isArray(data)) {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<{ expansions: Record<string, unknown> }>(
              dataDir,
              kind,
            )
            file.expansions[key] = data
            writeJsonFile(dataDir, kind, file)
            sendJson(res, 201, { ok: true, key })
            return
          }

          if (kind === 'frames') {
            const data = body as { frameID?: number }
            if (!validIndex(data.frameID)) {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<{ Frames: Array<unknown | null> }>(
              dataDir,
              kind,
            )
            const nextFrames = [...file.Frames]
            nextFrames[data.frameID] = body
            writeJsonFile(dataDir, kind, { Frames: nextFrames })
            sendJson(res, 201, { ok: true, frameID: data.frameID })
            return
          }

          if (kind === 'portraits') {
            const data = body as { avatarID?: number }
            if (!validIndex(data.avatarID)) {
              sendJson(res, 400, { error: 'INVALID_BODY' })
              return
            }
            const file = readJsonFile<{ Avatar: Array<unknown | null> }>(
              dataDir,
              kind,
            )
            const nextAvatars = [...file.Avatar]
            nextAvatars[data.avatarID] = body
            writeJsonFile(dataDir, kind, { Avatar: nextAvatars })
            sendJson(res, 201, { ok: true, avatarID: data.avatarID })
            return
          }
        }

        if (req.method === 'POST' && segment === 'upload/encounter-image') {
          const body = JSON.parse(await readLimitedBody(req)) as {
            fileName?: string
            encounterTitle?: string
            encounterId?: number
            dataBase64?: string
          }
          const imageBytes = decodeWebp(body?.dataBase64)
          const title = body?.encounterTitle?.trim()
          if (!imageBytes || (!title && !validImageName(body?.fileName))) {
            sendJson(res, 400, { error: 'INVALID_BODY' })
            return
          }

          const dir = join(imageDir, 'encounterimages')
          mkdirSync(dir, { recursive: true })

          let imageName: string
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
          writeFileWithBackup(join(dir, baseFile), imageBytes)
          sendJson(res, 201, {
            ok: true,
            path: `encounterimages/${baseFile}`,
            imageName,
          })
          return
        }

        if (req.method === 'POST' && segment === 'upload/solution-image') {
          const body = JSON.parse(await readLimitedBody(req)) as {
            fileName?: string
            dataBase64?: string
          }
          const fileName = body.fileName?.trim()
          const imageBytes = decodeWebp(body?.dataBase64)
          if (!validImageName(fileName) || !imageBytes) {
            sendJson(res, 400, { error: 'INVALID_BODY' })
            return
          }
          const base = fileName.endsWith('.webp') ? fileName : `${fileName}.webp`
          const dir = join(imageDir, 'solutionimages')
          mkdirSync(dir, { recursive: true })
          writeFileWithBackup(join(dir, base), imageBytes)
          sendJson(res, 201, { ok: true, path: `solutionimages/${base}` })
          return
        }

        sendJson(res, 404, { error: 'NOT_FOUND' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'LOCAL_API_ERROR'
        sendJson(res, error && typeof error === 'object' && 'status' in error && error.status === 413 ? 413 : 500, { error: message })
      }
    })()
  }
}

/**
 * @param publicRoot MorkahjaWebApp `client/public` (images and UI assets).
 * @param dataDir Folder holding the game JSON. Since Morkahja serves content
 *   from its server, this is `MorkahjaWebApp/server/game`; older checkouts
 *   kept the JSON in `client/public/game` (the default).
 */
export function morkahjaLocalContentPlugin(
  publicRoot: string,
  dataDir: string = join(publicRoot, 'game'),
): Plugin {
  const imageDir = join(publicRoot, 'game')
  const uiDir = join(publicRoot, 'UI')

  return {
    name: 'morkahja-local-content',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(localContentApi(dataDir, imageDir))
      server.middlewares.use(serveStatic(dataDir, '/game'))
      if (dataDir !== imageDir) server.middlewares.use(serveStatic(imageDir, '/game'))
      server.middlewares.use(serveStatic(uiDir, '/UI'))
    },
  }
}

/**
 * Where the game JSON lives: `MORKAHJA_GAME_DATA` if set, otherwise
 * `server/game` next to the configured `client/public`, falling back to
 * `client/public/game` for checkouts that still keep the JSON there.
 */
export function resolveMorkahjaGameDataDir(
  env: Record<string, string>,
  publicRoot: string,
): string {
  const configured = env.MORKAHJA_GAME_DATA?.trim()
  if (configured) return resolve(configured)

  const serverGame = resolve(publicRoot, '..', '..', 'server', 'game')
  if (existsSync(join(serverGame, 'encountersdata.json'))) return serverGame
  return join(publicRoot, 'game')
}

export function resolveMorkahjaPublicRoot(env: Record<string, string>): string {
  const configured = env.MORKAHJA_PUBLIC?.trim()
  if (configured) return resolve(configured)

  return resolve('C:/Users/Babun/Documents/Morkahja/MorkahjaWebApp/client/public')
}
