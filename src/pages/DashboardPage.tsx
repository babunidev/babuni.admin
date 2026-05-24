import { useQuery } from '@tanstack/react-query'
import { ActivityFeed } from '../components/ActivityFeed'
import { PageHeader } from '../components/PageHeader'
import { StatCard } from '../components/StatCard'
import { PLAYERS_POLL_MS } from '../config/constants'
import {
  fetchDashboardStats,
  fetchOnlinePlayers,
} from '../services/adminApi'

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: PLAYERS_POLL_MS,
  })

  const { data: online = [] } = useQuery({
    queryKey: ['onlinePlayers'],
    queryFn: fetchOnlinePlayers,
    refetchInterval: PLAYERS_POLL_MS,
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Live realm overview — online players and activity from your VPS."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online Now" value={stats?.onlinePlayers ?? online.length} />
        <StatCard label="Timed Out" value={stats?.timedOutPlayers ?? '—'} />
        <StatCard label="Banned" value={stats?.bannedPlayers ?? '—'} />
        <StatCard
          label="Events Today"
          value={stats?.eventsToday ?? '—'}
          hint="Rolling 24h window"
        />
      </div>
      <ActivityFeed />
    </div>
  )
}
