import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { Table, type Column } from '../components/Table'
import { fetchReports } from '../services/adminApi'
import type { Report } from '../types'
import { formatDateTime } from '../utils/format'

const columns: Column<Report>[] = [
  { key: 'id', header: 'ID', className: 'font-mono text-xs' },
  { key: 'reporter', header: 'Reporter' },
  { key: 'target', header: 'Target' },
  { key: 'reason', header: 'Reason', className: 'max-w-xs' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge value={row.status} />,
  },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row) => (
      <span className="text-fog">{formatDateTime(row.createdAt)}</span>
    ),
  },
]

export function ReportsPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  })

  const openCount = reports.filter((r) => r.status === 'open').length

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Player-submitted and automated moderation queue."
        action={
          <span className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright">
            {openCount} open
          </span>
        }
      />
      <Table columns={columns} data={reports} keyField="id" />
    </div>
  )
}
