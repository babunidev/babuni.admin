import { NavLink } from 'react-router-dom'
import type { Workspace } from './navigation'

/** A workspace's pages as tabs in its top bar; the sidebar chooses the workspace. */
export function WorkspaceTabs({ workspace }: { workspace: Workspace }) {
  return (
    <nav aria-label={`${workspace.label} navigation`} className="scrollbar-thin -mb-px flex h-full min-w-0 items-stretch overflow-x-auto">
      {workspace.navItems.map(item => (
        <NavLink key={item.to} to={item.to} end={item.to === workspace.home}
          className={({ isActive }) => `flex shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors sm:px-4 ${
            isActive
              ? 'border-gold-bright text-gold-bright'
              : 'border-transparent text-fog hover:border-gold/30 hover:text-parchment'}`}>
          <span aria-hidden className="text-gold/80">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
