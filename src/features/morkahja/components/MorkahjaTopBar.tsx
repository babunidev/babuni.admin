import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getApiDisplayLabel, useMockData } from '../../../config/api'
import { useLocalPostgres } from '../../../config/constants'
import { fetchServerStatus, pingPlayersApi } from './../services/adminApi'
import { useUiStore } from '../../../app/uiStore'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'
import { activateMorkahjaConnection } from '../../../shared/services/morkahjaConnection'

export function TopBar() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const [clock, setClock] = useState(() => new Date())
  const [adminConfigured,setAdminConfigured] = useState(false)
  useEffect(()=>{
    let mounted=true
    void localConnectionApi<{profiles:{id:string;projectId:string;kind:string;displayName:string}[]}>()
      .then(result=>{if(mounted)setAdminConfigured(Boolean(activateMorkahjaConnection(result.profiles)))})
      .catch(()=>{})
    return ()=>{mounted=false}
  },[])

  const playersSourceLive = useLocalPostgres || !useMockData

  const { data: server } = useQuery({
    queryKey: ['serverStatus'],
    queryFn: fetchServerStatus,
    staleTime: 60_000,
    retry: playersSourceLive ? 2 : 0,
  })

  const { data: apiReachable } = useQuery({
    queryKey: ['apiPing', useLocalPostgres],
    queryFn: pingPlayersApi,
    enabled: playersSourceLive,
    refetchInterval: 30_000,
    retry: 1,
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

  const linkLabel = adminConfigured ? 'Admin configured' : useMockData
    ? 'Mock'
    : useLocalPostgres
      ? apiReachable === true
        ? 'Postgres'
        : apiReachable === false
          ? 'DB offline'
          : '…'
      : apiReachable === true
        ? 'VPS'
        : apiReachable === false
          ? 'Offline'
          : '…'

  const linkTone = adminConfigured ? 'reviewing' : useMockData
    ? 'muted'
    : apiReachable
      ? 'online'
      : apiReachable === false
        ? 'offline'
        : 'reviewing'

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
        <span
          className="hidden max-w-[14rem] truncate text-fog lg:inline"
          title={adminConfigured ? 'Morkahja administrator (configured)' : getApiDisplayLabel()}
        >
          {adminConfigured ? 'Morkahja administrator' : getApiDisplayLabel()}
        </span>
        <StatusBadge value={linkTone} label={linkLabel} />
        {!adminConfigured && server && <StatusBadge value={server.state} />}
        {!adminConfigured && <span className="hidden text-fog md:inline">
          v{server?.version ?? '—'} · {server?.region ?? '—'}
        </span>}
        <span className="tabular-nums text-parchment/80">{timeLabel}</span>
      </div>
    </header>
  )
}
