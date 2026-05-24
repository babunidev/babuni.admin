export interface NavItem {
  to: string
  label: string
  icon: string
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/players', label: 'Players', icon: '◎' },
  { to: '/content', label: 'Content', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]
