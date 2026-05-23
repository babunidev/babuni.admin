import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchServerStatus } from '../services/adminApi'
import { useUiStore } from '../stores/uiStore'
import { StatusBadge } from './StatusBadge'

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const [clock, setClock] = useState(() => new Date())

  const { data: server } = useQuery({
    queryKey: ['serverStatus'],
    queryFn: fetchServerStatus,
    staleTime: 60_000,
  })

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const timeLabel = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(clock)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gold/15 bg-ash/80 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded border border-gold/20 px-2.5 py-1.5 text-sm text-fog transition hover:border-gold/40 hover:text-parchment lg:hidden"
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <div className="hidden sm:block">
          <p className="text-xs uppercase tracking-widest text-fog">Realm Console</p>
          <p className="text-sm text-parchment">{server?.label ?? '—'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 text-xs sm:gap-4">
        {server && <StatusBadge value={server.state} />}
        <span className="hidden text-fog md:inline">
          v{server?.version ?? '—'} · {server?.region ?? '—'}
        </span>
        <span className="tabular-nums text-parchment/80">{timeLabel}</span>
      </div>
    </header>
  )
}
