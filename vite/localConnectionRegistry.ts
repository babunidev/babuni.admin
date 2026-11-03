import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, openSync, writeFileSync, closeSync, chmodSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type ProjectId = 'morkahja' | 'babuni-dev'
export type ConnectionKind = 'local-files' | 'postgres-ssh' | 'github' | 'remote-publish'
export interface ConnectionProfile {
  id: string
  projectId: ProjectId
  displayName: string
  kind: ConnectionKind
  target: string
  enabled: boolean
  createdAt: string
}
export type ProfileInput = Pick<ConnectionProfile, 'projectId' | 'displayName' | 'kind' | 'target'>
export type ConnectionView = ConnectionProfile & { state: 'not-configured'; detail: string }

const projectKinds: Record<ProjectId, readonly ConnectionKind[]> = {
  morkahja: ['local-files', 'postgres-ssh'],
  'babuni-dev': ['github', 'remote-publish'],
}
const targetPatterns: Record<ConnectionKind, RegExp> = {
  'local-files': /^\/[\w .\-/]{1,250}$/,
  'postgres-ssh': /^[a-zA-Z0-9.-]{1,120}$/,
  github: /^[a-zA-Z0-9_.-]{1,100}\/[a-zA-Z0-9_.-]{1,100}$/,
  'remote-publish': /^[a-zA-Z0-9.-]{1,120}$/,
}
const forbidden = /(token|password|secret|bearer|authorization|apikey|api_key|private.key|postgres(?:ql)?:\/\/|https?:\/\/|@)/i

function validate(input: unknown): ProfileInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_PROFILE')
  const obj = input as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.some(key => !['projectId','displayName','kind','target'].includes(key))) throw new Error('UNKNOWN_FIELDS')
  const projectId = obj.projectId
  const kind = obj.kind
  const name = obj.displayName
  const target = obj.target
  if ((projectId !== 'morkahja' && projectId !== 'babuni-dev') ||
      typeof kind !== 'string' || !projectKinds[projectId].includes(kind as ConnectionKind) ||
      typeof name !== 'string' || name.trim().length < 1 || name.length > 80 ||
      typeof target !== 'string' || target.length > 250 ||
      forbidden.test(name) || forbidden.test(target) || !targetPatterns[kind as ConnectionKind].test(target)) {
    throw new Error('INVALID_PROFILE')
  }
  return { projectId, kind: kind as ConnectionKind, displayName: name.trim(), target }
}

export class LocalConnectionRegistry {
  private profiles: ConnectionProfile[] = []
  private readonly filePath: string
  constructor(filePath: string = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'babuni-admin', 'connections.json',
  )) {
    this.filePath = filePath
    if (existsSync(filePath)) {
      const loaded: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
      if (!Array.isArray(loaded)) throw new Error('INVALID_REGISTRY')
      this.profiles = loaded.map(row => {
        if (!row || typeof row !== 'object') throw new Error('INVALID_REGISTRY')
        const obj = row as ConnectionProfile
        const valid = validate({ projectId: obj.projectId, displayName: obj.displayName, kind: obj.kind, target: obj.target })
        if (typeof obj.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(obj.id) ||
            typeof obj.createdAt !== 'string' || typeof obj.enabled !== 'boolean') throw new Error('INVALID_REGISTRY')
        return { ...valid, id: obj.id, createdAt: obj.createdAt, enabled: obj.enabled }
      })
    }
  }

  list(): ConnectionView[] {
    return this.profiles.map(p => ({
      ...p, state: 'not-configured',
      detail: 'Profile saved locally; transport and credential support are not implemented.',
    }))
  }

  add(input: unknown): ConnectionView {
    const valid = validate(input)
    const p: ConnectionProfile = { ...valid, id: randomUUID(), enabled: false, createdAt: new Date().toISOString() }
    this.persist([...this.profiles, p])
    return { ...p, state: 'not-configured', detail: 'No connection attempted.' }
  }

  remove(id: string): boolean {
    const next = this.profiles.filter(p => p.id !== id)
    if (next.length === this.profiles.length) return false
    this.persist(next)
    return true
  }

  private persist(next: ConnectionProfile[]): void {
    // Use dirname semantics so custom XDG paths and test fixtures work identically.
    const parent = this.filePath.slice(0, this.filePath.lastIndexOf('/'))
    mkdirSync(parent, { recursive: true, mode: 0o700 })
    const tmp = this.filePath + '.' + randomUUID() + '.tmp'
    let fd: number | undefined
    try {
      fd = openSync(tmp, 'wx', 0o600)
      writeFileSync(fd, JSON.stringify(next, null, 2) + '\n')
      closeSync(fd)
      fd = undefined
      if (existsSync(this.filePath)) chmodSync(this.filePath, 0o600)
      renameSync(tmp, this.filePath)
      this.profiles = next
    } finally {
      if (fd !== undefined) closeSync(fd)
      if (existsSync(tmp)) unlinkSync(tmp)
    }
  }
}
