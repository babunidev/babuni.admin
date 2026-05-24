import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { PlayerDetailPanel } from '../components/PlayerDetailPanel'
import { ConnectionBanner } from '../components/ConnectionBanner'
import { PageHeader } from '../components/PageHeader'
import { PlayerModerationActions } from '../components/PlayerModerationActions'
import { StatusBadge } from '../components/StatusBadge'
import { Table, type Column } from '../components/Table'
import { PLAYERS_POLL_MS, useLocalPostgres } from '../config/constants'
import {
  fetchPlayersWithMeta,
  formatPlayersLoadError,
} from '../services/adminApi'
import type { Player } from '../types'
import { formatDateTime, formatRelative } from '../utils/format'
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

  const { data, error, isError, isLoading, isFetching } = useQuery({
    queryKey: ['players'],
    queryFn: fetchPlayersWithMeta,
    refetchInterval: (query) =>
      query.state.data?.dbError ? false : PLAYERS_POLL_MS,
    retry: 1,
  })

  const players = useMemo(
    () => sortPlayersForList(data?.players ?? []),
    [data?.players],
  )

  const onlineCount = countOnlinePlayers(players)
  const dbError = data?.dbError
  const showingSampleData = Boolean(data?.isSample && dbError)

  return (
    <div>
      <PageHeader
        title="Players"
        description={
          useLocalPostgres
            ? 'All accounts from PostgreSQL — online players listed first.'
            : 'All players from the server — online listed first.'
        }
      />
      {(dbError || isError) && (
        <ConnectionBanner
          {...formatPlayersLoadError(
            dbError ?? (error instanceof Error ? error : new Error('Unknown error')),
          )}
        />
      )}
      {showingSampleData && (
        <ConnectionBanner
          title="Showing sample players only"
          message="Connect PostgreSQL (SSH tunnel below) to load real accounts. Moderation actions on sample rows do not affect your database."
        />
      )}
      <p className="mb-4 text-xs text-fog">
        {isLoading
          ? 'Loading players…'
          : isFetching && !isLoading
            ? 'Refreshing…'
            : `${onlineCount} online · ${players.length} total${data?.isSample ? ' (sample)' : ''}`}
      </p>
      <p className="mb-2 text-xs text-fog/80">
        Click a row to view avatars, achievements, unlocks, and encounter history.
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
