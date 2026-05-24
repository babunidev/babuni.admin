import { useQuery } from '@tanstack/react-query'
import { ACTIVITY_POLL_MS } from '../config/constants'
import { fetchActivityFeed } from '../services/adminApi'
import type { ActivityFeedItem } from '../types'
import { formatDateTime } from '../utils/format'
import { StatusBadge } from './StatusBadge'

function importanceTone(item: ActivityFeedItem): string {
  if (item.importance === 'high') return 'border-gold/25 bg-gold/5'
  if (item.category === 'moderation') return 'border-ember/30 bg-ember/5'
  return 'border-gold/10 bg-ash/30'
}

export function ActivityFeed() {
  const { data: items = [], isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['activityFeed'],
    queryFn: fetchActivityFeed,
    refetchInterval: ACTIVITY_POLL_MS,
  })

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm uppercase tracking-widest text-fog">Live activity</h2>
        <span className="text-xs text-fog">
          {isFetching ? 'Updating…' : `Updated ${formatDateTime(new Date(dataUpdatedAt).toISOString())}`}
          {' · every 5s'}
        </span>
      </div>
      <ul className="scrollbar-thin max-h-[28rem] space-y-2 overflow-y-auto rounded-lg border border-gold/15 bg-slate/40 p-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-md border px-3 py-2.5 ${importanceTone(item)}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-parchment">{item.playerName}</span>
              <StatusBadge value={item.category} />
              {item.importance === 'high' && (
                <StatusBadge value="high" label="!" />
              )}
              <span className="ml-auto tabular-nums text-xs text-fog">
                {formatDateTime(item.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-sm text-parchment/85">{item.message}</p>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-fog">No activity yet.</li>
        )}
      </ul>
    </section>
  )
}
