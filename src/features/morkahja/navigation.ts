export interface NavItem {
  to: string
  label: string
  icon: string
}

export const morkahjaNavItems: NavItem[] = [
  { to: '/', label: 'Overview', icon: '◈' },
  { to: '/players', label: 'Moderation', icon: '◎' },
  { to: '/content', label: 'Content', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]
