import { morkahjaNavItems, type NavItem } from '../features/morkahja/navigation'
import { babuniDevNavItems } from '../features/babuni-dev/navigation'

export type WorkspaceId = 'morkahja' | 'babuni-dev'

export interface Workspace {
  id: WorkspaceId
  label: string
  home: string
  navItems: NavItem[]
}

export const workspaces: Workspace[] = [
  { id: 'morkahja', label: 'Morkahja', home: '/', navItems: morkahjaNavItems },
  { id: 'babuni-dev', label: 'babuni.dev', home: '/babuni-dev', navItems: babuniDevNavItems },
]

export const workspaceById = (id: WorkspaceId): Workspace =>
  workspaces.find(workspace => workspace.id === id)!

/** Pages above the workspaces, reached from the sidebar's own buttons. */
export function isMetaPath(pathname: string): boolean {
  return ['/projects', '/connections'].some(base => pathname === base || pathname.startsWith(base + '/'))
}

// Workspace choice follows the URL, so refreshes, bookmarks and back/forward agree.
export function workspaceForPath(pathname: string): Workspace {
  return pathname === '/babuni-dev' || pathname.startsWith('/babuni-dev/')
    ? workspaces[1]
    : workspaces[0]
}

// Preserve the existing import until remaining consumers migrate.
export const navItems = morkahjaNavItems
