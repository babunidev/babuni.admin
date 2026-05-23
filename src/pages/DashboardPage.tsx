import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { Table, type Column } from '../components/Table'
import { StatusBadge } from '../components/StatusBadge'
import { fetchDashboardStats, fetchLogs } from '../services/adminApi'
import type { LogEntry } from '../types'
import { formatDateTime } from '../utils/format'

const recentColumns: Column<LogEntry>[] = [
  {
    key: 'timestamp',
    header: 'Time',
    render: (row) => (
      <span className="tabular-nums text-fog">{formatDateTime(row.timestamp)}</span>
    ),
  },
  {
    key: 'level',
    header: 'Level',
    render: (row) => <StatusBadge value={row.level} />,
  },
  { key: 'source', header: 'Source' },
  { key: 'message', header: 'Message', className: 'max-w-md' },
]

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  })

  const { data: logs = [] } = useQuery({
    queryKey: ['logs', 'recent'],
    queryFn: fetchLogs,
  })

  const recent = logs.slice(0, 3)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of realm health, moderation load, and recent activity."
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online Players" value={stats?.onlinePlayers ?? '—'} />
        <StatCard label="Active Reports" value={stats?.activeReports ?? '—'} />
        <StatCard label="Events Today" value={stats?.eventsToday ?? '—'} />
        <StatCard
          label="Server Uptime"
          value={stats?.serverUptime ?? '—'}
          hint="Mock telemetry"
        />
      </div>
      <section>
        <h2 className="mb-3 text-sm uppercase tracking-widest text-fog">
          Recent Logs
        </h2>
        <Table columns={recentColumns} data={recent} keyField="id" />
      </section>
    </div>
  )
}
