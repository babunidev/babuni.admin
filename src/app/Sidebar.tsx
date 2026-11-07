import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useUiStore } from './uiStore'
import { workspaceForPath, workspaces, type WorkspaceId } from './navigation'

export function Sidebar() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const current = workspaceForPath(pathname)

  const selectWorkspace = (id: WorkspaceId) => {
    const target = workspaces.find((workspace) => workspace.id === id)
    if (target) {
      setSidebarOpen(false)
      navigate(target.home)
    }
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gold/15 bg-slate/95 lg:w-60">
      <div className="border-b border-gold/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <img src="/favicon.webp" alt="" width={32} height={32}
            className="h-8 w-8 shrink-0 rounded-sm" />
          <p className="text-xs uppercase tracking-[0.25em] text-fog">Babuni Admin</p>
        </div>
        <label htmlFor="workspace-select" className="mt-4 block text-xs text-fog">
          Workspace
        </label>
        <select
          id="workspace-select"
          aria-label="Select workspace"
          value={current.id}
          onChange={(event) => selectWorkspace(event.target.value as WorkspaceId)}
          className="mt-1 w-full rounded border border-gold/20 bg-ash px-3 py-2 text-sm text-parchment focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>{workspace.label}</option>
          ))}
        </select>
      </div>
      <nav aria-label={`${current.label} navigation`} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {current.navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/' || item.to === '/babuni-dev'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-gold/15 text-gold-bright'
                      : 'text-fog hover:bg-ash/80 hover:text-parchment'
                  }`
                }
              >
                <span className="w-4 text-center text-gold/80" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-gold/10 px-3 py-2">
        <NavLink to="/connections" onClick={() => setSidebarOpen(false)}
          className="block rounded-md px-3 py-2.5 text-sm text-fog hover:bg-ash/80 hover:text-parchment">
          ◎ Connection
        </NavLink>
      </div>
      <p className="border-t border-gold/10 px-5 py-4 text-[10px] uppercase tracking-widest text-fog/70">
        Local console · 127.0.0.1
      </p>
    </aside>
  )
}
