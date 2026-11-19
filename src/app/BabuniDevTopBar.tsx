import { useUiStore } from './uiStore'
import { WorkspaceTabs } from './WorkspaceTabs'
import { workspaceById } from './navigation'

export function BabuniDevTopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <header className="flex h-14 shrink-0 items-stretch gap-3 border-b border-gold/15 bg-ash/80 px-4 backdrop-blur-sm lg:px-6">
      <button
        type="button"
        onClick={toggleSidebar}
        className="my-auto rounded border border-gold/20 px-2.5 py-1.5 text-sm text-fog transition hover:border-gold/40 hover:text-parchment lg:hidden"
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <WorkspaceTabs workspace={workspaceById('babuni-dev')} />
      <p className="my-auto ml-auto hidden shrink-0 text-xs text-fog md:block">www.babuni.dev</p>
    </header>
  )
}
