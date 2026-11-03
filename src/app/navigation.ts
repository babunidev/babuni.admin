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
  { id: 'babuni-dev', label: 'Babuni Dev', home: '/babuni-dev', navItems: babuniDevNavItems },
]

// Workspace choice follows the URL, so refreshes, bookmarks and back/forward agree.
export function workspaceForPath(pathname: string): Workspace {
  return pathname === '/babuni-dev' || pathname.startsWith('/babuni-dev/')
    ? workspaces[1]
    : workspaces[0]
}

// Preserve the existing import until remaining consumers migrate.
export const navItems = morkahjaNavItems
