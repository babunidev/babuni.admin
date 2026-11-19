import { Link, NavLink, useLocation } from 'react-router-dom'
import { useUiStore } from './uiStore'
import { isMetaPath, workspaceById, workspaceForPath, type WorkspaceId } from './navigation'

// The sidebar chooses where to work; each workspace's own pages are tabs in its top bar.
const places: ({ kind: 'meta'; to: string; label: string; icon: string } | { kind: 'workspace'; id: WorkspaceId; icon: string })[] = [
  { kind: 'meta', to: '/projects', label: 'Project Manager', icon: '◇' },
  { kind: 'workspace', id: 'babuni-dev', icon: '◈' },
  { kind: 'workspace', id: 'morkahja', icon: '✦' },
]

const placeClass = (active: boolean) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
  active ? 'bg-gold/15 text-gold-bright' : 'text-fog hover:bg-ash/80 hover:text-parchment'}`

export function Sidebar() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const { pathname } = useLocation()
  const current = isMetaPath(pathname) ? null : workspaceForPath(pathname).id
  const close = () => setSidebarOpen(false)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gold/15 bg-slate/95 lg:w-60">
      <div className="border-b border-gold/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <img src="/favicon.webp" alt="" width={32} height={32}
            className="h-8 w-8 shrink-0 rounded-sm" />
          <p className="text-xs uppercase tracking-[0.25em] text-fog">Babuni Admin</p>
        </div>
      </div>
      <nav aria-label="Workspaces" className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {places.map(place => {
            if (place.kind === 'meta') return (
              <li key={place.to}>
                <NavLink to={place.to} onClick={close} className={({ isActive }) => placeClass(isActive)}>
                  <span className="w-4 text-center text-gold/80" aria-hidden>{place.icon}</span>
                  {place.label}
                </NavLink>
              </li>
            )
            const workspace = workspaceById(place.id)
            const active = current === place.id
            return (
              <li key={place.id}>
                <Link to={workspace.home} onClick={close} aria-current={active ? 'page' : undefined}
                  className={placeClass(active)}>
                  <span className="w-4 text-center text-gold/80" aria-hidden>{place.icon}</span>
                  {workspace.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-gold/10 px-3 py-2">
        <NavLink to="/connections" onClick={close} className={({ isActive }) => placeClass(isActive)}>
          <span className="w-4 text-center text-gold/80" aria-hidden>◎</span>
          Connection
        </NavLink>
      </div>
      <p className="border-t border-gold/10 px-5 py-4 text-[10px] uppercase tracking-widest text-fog/70">
        Local console · 127.0.0.1
      </p>
    </aside>
  )
}
