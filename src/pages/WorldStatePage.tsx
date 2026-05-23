import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { fetchWorldMetrics } from '../services/adminApi'

export function WorldStatePage() {
  const { data: metrics = [] } = useQuery({
    queryKey: ['worldMetrics'],
    queryFn: fetchWorldMetrics,
  })

  return (
    <div>
      <PageHeader
        title="World State"
        description="Live realm metrics and environmental pressure indicators."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.id}
            className="rounded-lg border border-gold/15 bg-slate/60 p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-fog">
                {metric.label}
              </p>
              <StatusBadge value={metric.trend} className="border-0 bg-transparent" />
            </div>
            <p className="mt-3 text-2xl font-medium text-parchment">{metric.value}</p>
            {metric.detail && (
              <p className="mt-2 text-sm text-fog">{metric.detail}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
