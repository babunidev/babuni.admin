import { useUiStore } from './uiStore'

export function BabuniDevTopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gold/15 bg-ash/80 px-4 backdrop-blur-sm lg:px-6">
      <button
        type="button"
        onClick={toggleSidebar}
        className="rounded border border-gold/20 px-2.5 py-1.5 text-sm text-fog transition hover:border-gold/40 hover:text-parchment lg:hidden"
        aria-label="Toggle navigation"
      >
        ☰
      </button>
      <div>
        <p className="text-xs uppercase tracking-widest text-fog">Babuni Dev</p>
        <p className="text-sm text-parchment">Portfolio workspace · Planned features</p>
      </div>
    </header>
  )
}
