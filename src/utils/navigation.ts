export interface NavItem {
  to: string
  label: string
  icon: string
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/players', label: 'Players', icon: '◎' },
  { to: '/logs', label: 'Logs', icon: '▤' },
  { to: '/reports', label: 'Reports', icon: '⚑' },
  { to: '/world-state', label: 'World State', icon: '◇' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]
