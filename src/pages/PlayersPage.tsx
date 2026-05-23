import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { Table, type Column } from '../components/Table'
import { fetchPlayers } from '../services/adminApi'
import type { Player } from '../types'
import { formatRelative } from '../utils/format'

const columns: Column<Player>[] = [
  { key: 'name', header: 'Player' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge value={row.status} />,
  },
  { key: 'level', header: 'Level', className: 'tabular-nums' },
  { key: 'realm', header: 'Realm' },
  {
    key: 'lastSeen',
    header: 'Last Seen',
    render: (row) => (
      <span className="text-fog">{formatRelative(row.lastSeen)}</span>
    ),
  },
  {
    key: 'id',
    header: 'ID',
    render: (row) => (
      <span className="font-mono text-xs text-fog">{row.id}</span>
    ),
  },
]

export function PlayersPage() {
  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: fetchPlayers,
  })

  return (
    <div>
      <PageHeader
        title="Players"
        description="Inspect online presence, sanctions, and realm assignment."
        action={
          <span className="text-xs text-fog">
            {isLoading ? 'Loading…' : `${players.length} records`}
          </span>
        }
      />
      <Table columns={columns} data={players} keyField="id" />
    </div>
  )
}
