import { NavLink } from 'react-router-dom'
import { useUiStore } from '../stores/uiStore'
import { navItems } from '../utils/navigation'

export function Sidebar() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-gold/15 bg-slate/95 lg:w-60">
      <div className="border-b border-gold/10 px-5 py-5">
        <p className="text-xs uppercase tracking-[0.25em] text-fog">Morkahja</p>
        <h2 className="mt-1 text-lg font-medium tracking-wide text-gold-bright">
          Admin
        </h2>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
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
      <p className="border-t border-gold/10 px-5 py-4 text-[10px] uppercase tracking-widest text-fog/70">
        Local console · 127.0.0.1
      </p>
    </aside>
  )
}
