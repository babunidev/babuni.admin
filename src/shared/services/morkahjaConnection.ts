// A single operator-owned Morkahja administrator connection is selected in
// Connection, not separately on every workspace page.
export const MORKAHJA_CONNECTION_KEY = 'babuni-admin:morkahja:moderation-profile'

export interface MorkahjaConnection {
  id: string
  projectId: string
  kind: string
  displayName: string
  target?: string
}

export function resolveMorkahjaConnection(profiles: MorkahjaConnection[]): MorkahjaConnection | null {
  const administrators=profiles.filter(profile=>
    profile.projectId==='morkahja' && profile.kind==='postgres-ssh-moderation')
  if(administrators.length===0)return null
  if(administrators.length===1)return administrators[0]
  try {
    const saved=window.localStorage.getItem(MORKAHJA_CONNECTION_KEY)
    return administrators.find(profile=>profile.id===saved) || null
  }catch {return null}
}

export function activateMorkahjaConnection(profiles: MorkahjaConnection[]): MorkahjaConnection | null {
  const profile=resolveMorkahjaConnection(profiles)
  try {
    if(profile)window.localStorage.setItem(MORKAHJA_CONNECTION_KEY,profile.id)
    else window.localStorage.removeItem(MORKAHJA_CONNECTION_KEY)
  }catch { /* Session storage may be unavailable; no credential is stored here. */ }
  return profile
}
