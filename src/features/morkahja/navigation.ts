export interface NavItem {
  to: string
  label: string
  icon: string
}

export const morkahjaNavItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/read-only', label: 'Read-only', icon: '◇' },
  { to: '/players', label: 'Players', icon: '◎' },
  { to: '/content', label: 'Content', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]
