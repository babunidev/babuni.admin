export type ProjectId = 'morkahja' | 'babuni-dev'
export type ConnectionKind = 'local-files' | 'postgres-ssh' | 'github' | 'remote-publish'
export type Capability = 'local:test' | 'local:inspect' | 'local:connect' | 'db:connect' | 'db:health' | 'db:players'
export interface AdapterSpec {
  projectId: ProjectId
  kind: ConnectionKind
  transport: 'local' | 'ssh' | 'planned'
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
    projectId: 'morkahja', kind: 'postgres-ssh', transport: 'ssh',
    requiresCredential: true, capabilities: ['db:connect','db:health','db:players'],
  },
  github: {
    projectId: 'babuni-dev', kind: 'github', transport: 'planned',
    requiresCredential: true, capabilities: [],
  },
  'remote-publish': {
    projectId: 'babuni-dev', kind: 'remote-publish', transport: 'planned',
    requiresCredential: true, capabilities: [],
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
