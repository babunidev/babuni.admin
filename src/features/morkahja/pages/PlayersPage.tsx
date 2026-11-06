import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { PlayerDetailPanel } from '../components/PlayerDetailPanel'
import { ConnectionBanner } from '../../../shared/components/ConnectionBanner'
import { PageHeader } from '../../../shared/components/PageHeader'
import { PlayerModerationActions } from '../components/PlayerModerationActions'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { Table, type Column } from '../../../shared/components/Table'
import { PLAYERS_POLL_MS, useLocalPostgres } from '../../../config/constants'
import { getApiDisplayLabel } from '../../../config/api'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'
import {
  fetchPlayersWithMeta,
  formatPlayersLoadError,
  getModerationProfileId,
  MODERATION_PROFILE_KEY,
} from '../services/adminApi'
import type { Player } from '../../../types'
import { formatDateTime, formatRelative } from '../../../shared/utils/format'
import { countOnlinePlayers, sortPlayersForList } from '../utils/players'

const columns: Column<Player>[] = [
  {
    key: 'name',
    header: 'Player',
    render: (row) => (
      <span className="font-medium text-gold-bright/90 group-hover:text-gold-bright">
        {row.name}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge value={row.status} />,
  },
  {
    key: 'activeAvatar',
    header: 'Avatar',
    render: (row) => (
      <span className="text-fog">{row.activeAvatar ?? '—'}</span>
    ),
  },
  { key: 'level', header: 'Level', className: 'tabular-nums' },
  { key: 'realm', header: 'Race · Role' },
  {
    key: 'avatarCount',
    header: 'Avatars',
    className: 'tabular-nums',
    render: (row) => (
      <span className="text-fog">{row.avatarCount ?? '—'}</span>
    ),
  },
  {
    key: 'lastSeen',
    header: 'Last Seen',
    render: (row) => (
      <span className="text-fog">{formatRelative(row.lastSeen)}</span>
    ),
  },
  {
    key: 'timeoutUntil',
    header: 'Timeout Until',
    render: (row) => (
      <span className="text-fog">
        {row.timeoutUntil ? formatDateTime(row.timeoutUntil) : '—'}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (row) => (
      <div onClick={(event) => event.stopPropagation()} role="presentation">
        <PlayerModerationActions player={row} />
      </div>
    ),
  },
]

export function PlayersPage() {
  const { playerId } = useParams<{ playerId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [profileId, setProfileId] = useState(() => getModerationProfileId() || '')
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [profiles, setProfiles] = useState<{id:string;displayName:string}[]>([])
  const [profileStatus, setProfileStatus] = useState('Checking scoped moderation profiles…')

  useEffect(() => {
    let mounted = true
    void localConnectionApi<{profiles:{
      id:string;projectId:string;kind:string;displayName:string
    }[]}>().then(result => {
      if (!mounted) return
      const available = result.profiles.filter(p =>
        p.projectId === 'morkahja' && p.kind === 'postgres-ssh-moderation')
      setProfiles(available)
      const current = getModerationProfileId()
      if (current && !available.some(p => p.id === current)) {
        window.localStorage.removeItem(MODERATION_PROFILE_KEY)
        setProfileId('')
      }
      setProfileStatus(available.length
        ? 'Select a separate authorized moderation profile; reads and writes are not enabled by the Overview profile.'
        : 'No separate live moderation profile is configured. Legacy/demo mode remains available.')
      setProfilesLoaded(true)
    }).catch(() => {
      if (!mounted) return
      setProfileStatus('Local connection service unavailable; privileged SSH moderation not verified.')
      setProfilesLoaded(true)
    })
    return () => {mounted = false}
  }, [])

  function selectProfile(id: string) {
    if (id) window.localStorage.setItem(MODERATION_PROFILE_KEY, id)
    else window.localStorage.removeItem(MODERATION_PROFILE_KEY)
    setProfileId(id)
    queryClient.removeQueries({ queryKey: ['players'] })
    queryClient.removeQueries({ queryKey: ['playerDetail'] })
    navigate('/players')
  }

  const { data, error, isError, isLoading, isFetching } = useQuery({
    queryKey: ['players', profileId || 'legacy'],
    queryFn: fetchPlayersWithMeta,
    enabled: profilesLoaded,
    refetchInterval: (query) =>
      profileId || query.state.data?.dbError ? false : PLAYERS_POLL_MS,
    retry: 1,
  })

  const players = useMemo(
    () => sortPlayersForList(data?.players ?? []),
    [data?.players],
  )

  const onlineCount = countOnlinePlayers(players)
  const dbError = data?.dbError
  const showingSampleData = Boolean(data?.isSample)

  return (
    <div>
      <PageHeader
        title="Moderation"
        description={profileId
          ? 'Authorized account list from the selected Morkahja moderator profile.'
          : useLocalPostgres
            ? 'Legacy PostgreSQL account list — online estimates first.'
            : 'Players from the selected legacy or demo source.'}

      />
      <div className="mb-3 rounded border border-gold/20 bg-slate/40 p-3">
        <label htmlFor="moderation-profile" className="block text-xs text-fog">
          Live moderation connection (separate from Overview)
        </label>
        <select id="moderation-profile" value={profileId}
          onChange={event => selectProfile(event.target.value)}
          className="mt-2 w-full rounded border border-gold/20 bg-ash p-2 text-sm text-parchment">
          <option value="">Legacy / demo source (not verified by Connections)</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
        <p className="mt-2 text-xs text-fog" role="status">
          {profileStatus}
          {profileId
            ? isError ? ' · Moderation SSH request failed; no mock fallback.'
              : data ? ' · Last scoped read succeeded; SSH disconnected after snapshot.'
                : ' · Awaiting scoped database authorization.'
            : ' · Current source: ' + getApiDisplayLabel()}
        </p>
      </div>
      {(dbError || isError) && (
        <ConnectionBanner
          {...formatPlayersLoadError(
            dbError ?? (error instanceof Error ? error : new Error('Unknown error')),
          )}
        />
      )}
      {showingSampleData && (
        <ConnectionBanner
          title="Sample players — not live Morkahja accounts"
          message="These records are local demonstration data. No live database read or moderation action is implied."
        />
      )}
      <p className="mb-4 text-xs text-fog">
        {isLoading
          ? 'Loading players…'
          : isFetching && !isLoading
            ? 'Refreshing…'
            : isError ? 'Player list unavailable — no fallback data' :
              `${onlineCount} accounts with valid sessions (estimate) · ${players.length} total${data?.isSample ? ' (sample)' : ''}`}
      </p>
      <p className="mb-2 text-xs text-fog/80">
        Session-based online status is an estimate, not a verified presence heartbeat. Click a row for avatars, achievements, unlocks and encounter history.
      </p>
      <Table
        columns={columns}
        data={players}
        keyField="id"
        selectedKey={playerId}
        onRowClick={(row) => navigate(`/players/${encodeURIComponent(row.id)}`)}
        emptyMessage={
          isError
            ? 'Fix the database connection above, then refresh this page.'
            : 'No players in the database yet.'
        }
      />
      {playerId && (
        <PlayerDetailPanel
          playerId={playerId}
          onClose={() => navigate('/players')}
        />
      )}
    </div>
  )
}
