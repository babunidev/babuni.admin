import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { Table, type Column } from '../components/Table'
import { fetchLogs } from '../services/adminApi'
import type { LogEntry } from '../types'
import { formatDateTime } from '../utils/format'

const columns: Column<LogEntry>[] = [
  {
    key: 'timestamp',
    header: 'Timestamp',
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
  { key: 'message', header: 'Message', className: 'max-w-lg' },
]

export function LogsPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ['logs'],
    queryFn: fetchLogs,
  })

  return (
    <div>
      <PageHeader
        title="Logs"
        description="Audit trail for moderation, world events, and system signals."
      />
      <Table columns={columns} data={logs} keyField="id" />
    </div>
  )
}
