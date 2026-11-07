export type ProjectId = 'morkahja' | 'babuni-dev'
export type ConnectionKind = 'local-files' | 'postgres-ssh' | 'postgres-ssh-moderation' | 'ssh-content' | 'github' | 'remote-publish'
export type Capability = 'local:test' | 'local:inspect' | 'local:connect' | 'ssh:preflight' | 'ssh:probe' | 'ssh:read' | 'ssh:moderation' | 'ssh:content' | 'github:probe' | 'website:probe'
export interface AdapterSpec {
  projectId: ProjectId
  kind: ConnectionKind
  transport: 'local' | 'planned' | 'read-only'
  requiresCredential: boolean
  capabilities: readonly Capability[]
}

// Server-owned allowlist: frontend selections and profile UUIDs confer no rights.
export const adapterSpecs: Record<ConnectionKind, AdapterSpec> = {
  'local-files': {
    projectId: 'morkahja', kind: 'local-files', transport: 'local',
    requiresCredential: false, capabilities: ['local:test','local:inspect','local:connect'],
  },
  'postgres-ssh': {
    projectId: 'morkahja', kind: 'postgres-ssh', transport: 'planned',
    requiresCredential: true, capabilities: ['ssh:preflight','ssh:probe','ssh:read'],
  },
  'postgres-ssh-moderation': {
    projectId: 'morkahja', kind: 'postgres-ssh-moderation', transport: 'local',
    requiresCredential: true, capabilities: ['ssh:preflight','ssh:read','ssh:moderation','ssh:content'],
  },
  'ssh-content': {
    projectId: 'morkahja', kind: 'ssh-content', transport: 'local',
    requiresCredential: false, capabilities: ['ssh:preflight','ssh:content'],
  },
  github: {
    projectId: 'babuni-dev', kind: 'github', transport: 'read-only',
    requiresCredential: true, capabilities: ['github:probe'],
  },
  'remote-publish': {
    projectId: 'babuni-dev', kind: 'remote-publish', transport: 'read-only',
    requiresCredential: true, capabilities: ['website:probe'],
  },
}

export function specForProfile(profile: {projectId: string; kind: string}): AdapterSpec | null {
  if (!Object.prototype.hasOwnProperty.call(adapterSpecs, profile.kind)) return null
  const spec = adapterSpecs[profile.kind as ConnectionKind]
  return spec.projectId === profile.projectId ? spec : null
}
export function hasCapability(profile: {projectId: string; kind: string}, capability: Capability): boolean {
  return specForProfile(profile)?.capabilities.includes(capability) ?? false
}
