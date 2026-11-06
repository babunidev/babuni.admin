import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, openSync, writeFileSync, closeSync, chmodSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { specForProfile, type ProjectId, type ConnectionKind } from './connectionAdapters.ts'

export type { ProjectId, ConnectionKind }
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
export type ProfileEdit = Pick<ConnectionProfile, 'displayName' | 'target'>
export type ConnectionView = ConnectionProfile & { state: 'not-configured'; detail: string }

const targetPatterns: Record<ConnectionKind, RegExp> = {
  'local-files': /^\/[\w .\-/]{1,250}$/,
  'postgres-ssh-moderation': /^(?=.{1,120}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  'postgres-ssh': /^(?=.{1,120}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  github: /^[a-zA-Z0-9_.-]{1,100}\/[a-zA-Z0-9_.-]{1,100}$/,
  'remote-publish': /^[a-zA-Z0-9.-]{1,120}$/,
}
const forbidden = /(token|password|secret|bearer|authorization|apikey|api_key|private.key|postgres(?:ql)?:\/\/|https?:\/\/|@)/i

function validate(input: unknown): ProfileInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_PROFILE')
  const obj = input as Record<string, unknown>
  if (Object.keys(obj).some(key => !['projectId','displayName','kind','target'].includes(key))) {
    throw new Error('UNKNOWN_FIELDS')
  }
  const {projectId,kind,displayName,target} = obj
  if (typeof projectId !== 'string' || typeof kind !== 'string' ||
      !specForProfile({projectId,kind}) ||
      typeof displayName !== 'string' || !displayName.trim() || displayName.length > 80 ||
      typeof target !== 'string' || !target || target.length > 250 ||
      forbidden.test(displayName) || forbidden.test(target) ||
      !targetPatterns[kind as ConnectionKind].test(target)) throw new Error('INVALID_PROFILE')
  return {projectId:projectId as ProjectId,kind:kind as ConnectionKind,displayName:displayName.trim(),target}
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
        const valid = validate({projectId:obj.projectId,displayName:obj.displayName,kind:obj.kind,target:obj.target})
        if (typeof obj.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(obj.id) ||
            typeof obj.createdAt !== 'string' || typeof obj.enabled !== 'boolean') throw new Error('INVALID_REGISTRY')
        return {...valid,id:obj.id,createdAt:obj.createdAt,enabled:obj.enabled}
      })
    }
  }

  list(): ConnectionView[] {
    return this.profiles.map(p => ({
      ...p,state:'not-configured',
      detail:'Profile saved locally. Transport access is limited to registered capabilities.',
    }))
  }

  add(input: unknown): ConnectionView {
    const valid=validate(input)
    const profile: ConnectionProfile = {
      ...valid,id:randomUUID(),enabled:false,createdAt:new Date().toISOString(),
    }
    this.persist([...this.profiles,profile])
    return {...profile,state:'not-configured',detail:'No connection attempted.'}
  }

  update(id: string, input: unknown): ConnectionView | null {
    const current=this.profiles.find(p=>p.id===id)
    if (!current) return null
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_PROFILE')
    const data=input as Record<string,unknown>
    if (Object.keys(data).some(key=>!['displayName','target'].includes(key)) ||
        !Object.prototype.hasOwnProperty.call(data,'displayName') ||
        !Object.prototype.hasOwnProperty.call(data,'target')) throw new Error('UNKNOWN_FIELDS')
    // Project, adapter, ID, creation date and credential identity remain immutable.
    const next=validate({projectId:current.projectId,kind:current.kind,
      displayName:data.displayName,target:data.target})
    this.persist(this.profiles.map(p=>p.id===id ? {...p,...next} : p))
    return {...current,...next,state:'not-configured',detail:'Profile updated; recheck before using.'}
  }

  remove(id: string): boolean {
    const next=this.profiles.filter(p=>p.id!==id)
    if (next.length===this.profiles.length) return false
    this.persist(next)
    return true
  }

  private persist(next: ConnectionProfile[]): void {
    mkdirSync(dirname(this.filePath),{recursive:true,mode:0o700})
    const tmp=this.filePath+'.'+randomUUID()+'.tmp'
    let fd: number | undefined
    try {
      fd=openSync(tmp,'wx',0o600)
      writeFileSync(fd,JSON.stringify(next,null,2)+'\n')
      closeSync(fd)
      fd=undefined
      if (existsSync(this.filePath)) chmodSync(this.filePath,0o600)
      renameSync(tmp,this.filePath)
      this.profiles=next
    } finally {
      if(fd!==undefined)closeSync(fd)
      if(existsSync(tmp))unlinkSync(tmp)
    }
  }
}
