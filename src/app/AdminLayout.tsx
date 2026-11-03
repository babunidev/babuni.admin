import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar as MorkahjaTopBar } from '../features/morkahja/components/MorkahjaTopBar'
import { BabuniDevTopBar } from './BabuniDevTopBar'
import { workspaceForPath } from './navigation'
import { useUiStore } from './uiStore'

export function AdminLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const { pathname } = useLocation()
  const isBabuniDev = workspaceForPath(pathname).id === 'babuni-dev'

  return (
    <div className="app-grain flex h-full min-h-0 bg-void">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-void/70 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {isBabuniDev ? <BabuniDevTopBar /> : <MorkahjaTopBar />}
        <main className="scrollbar-thin flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
