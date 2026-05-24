import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchPlayerDetail } from '../services/adminApi'
import type { PlayerDetail, PlayerDetailAvatar } from '../types/playerDetail'
import { formatAchievementId } from '../utils/achievementLabels'
import { formatDateTime, formatRelative } from '../utils/format'
import { PlayerModerationActions } from './PlayerModerationActions'
import { StatusBadge } from './StatusBadge'

interface PlayerDetailPanelProps {
  playerId: string
  onClose: () => void
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-gold/10 pb-5 last:border-0 last:pb-0">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-gold-bright">
        {title}
      </h3>
      {children}
    </section>
  )
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-gold/10 bg-void/40 px-3 py-2"
        >
          <dt className="text-[10px] uppercase tracking-wider text-fog">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-sm text-parchment">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AvatarCard({ avatar }: { avatar: PlayerDetailAvatar }) {
  return (
    <article
      className={`rounded-lg border px-4 py-3 ${
        avatar.isActive
          ? 'border-gold/35 bg-gold/5'
          : 'border-gold/10 bg-void/30'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-parchment">
            {avatar.name}
            {avatar.isActive && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-bright">
                Active
              </span>
            )}
          </p>
          <p className="text-xs text-fog">
            {avatar.race ?? '—'} · {avatar.role ?? '—'}
          </p>
        </div>
        <p className="text-sm tabular-nums text-gold-bright">
          Lv {avatar.progression.level}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-fog sm:grid-cols-3">
        <div>
          <dt className="text-[10px] uppercase">XP</dt>
          <dd className="text-parchment">{avatar.progression.experience}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase">Completed</dt>
          <dd className="text-parchment">
            {avatar.progression.encountersCompleted}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase">Failed</dt>
          <dd className="text-parchment">
            {avatar.progression.encountersFailed}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase">Spellbook</dt>
          <dd className="text-parchment">{avatar.inventoryCounts.spellbook}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase">Items</dt>
          <dd className="text-parchment">{avatar.inventoryCounts.items}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase">Essences</dt>
          <dd className="text-parchment">{avatar.inventoryCounts.essences}</dd>
        </div>
      </dl>
      {(avatar.lastEncounterId || avatar.activeEncounterTitle) && (
        <p className="mt-2 text-xs text-fog">
          {avatar.activeEncounterTitle
            ? `In encounter: ${avatar.activeEncounterTitle}`
            : avatar.lastEncounterId
              ? `Last encounter #${avatar.lastEncounterId}`
              : null}
        </p>
      )}
      {avatar.editMode && (
        <p className="mt-1 text-xs text-amber-300/90">Edit mode enabled</p>
      )}
    </article>
  )
}

function PlayerDetailContent({ detail }: { detail: PlayerDetail }) {
  const { summary } = detail
  const currencyEntries = Object.entries(detail.currencies)
  const loreGemEntries = Object.entries(detail.loreGemClaims).filter(
    ([, claimed]) => claimed,
  )

  return (
    <div className="space-y-6">
      <DetailSection title="Account">
        <StatGrid
          items={[
            { label: 'Player ID', value: detail.playerId },
            {
              label: 'Public key',
              value: detail.identityPublicKey
                ? `${detail.identityPublicKey.slice(0, 16)}…`
                : '—',
            },
            { label: 'Created', value: formatDateTime(detail.createdAt) },
            { label: 'Last played', value: formatRelative(detail.lastPlayedAt) },
            {
              label: 'Friends',
              value:
                detail.friendIds.length > 0
                  ? `${detail.friendIds.length} linked`
                  : 'None',
            },
          ]}
        />
        {summary.banReason && (
          <p className="mt-3 text-sm text-red-300/90">
            Ban reason: {summary.banReason}
          </p>
        )}
        {summary.timeoutUntil && (
          <p className="mt-2 text-sm text-gold-bright">
            Timeout until {formatDateTime(summary.timeoutUntil)}
          </p>
        )}
      </DetailSection>

      <DetailSection title={`Avatars (${detail.avatars.length})`}>
        {detail.avatars.length === 0 ? (
          <p className="text-sm text-fog">No avatars created.</p>
        ) : (
          <div className="space-y-3">
            {detail.avatars.map((avatar) => (
              <AvatarCard key={avatar.id} avatar={avatar} />
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title="Unlocks & account progress">
        <StatGrid
          items={[
            {
              label: 'Expansions',
              value:
                detail.unlockedExpansions.length > 0
                  ? detail.unlockedExpansions.join(', ')
                  : 'None',
            },
            {
              label: 'Daily reward',
              value: detail.dailyReward
                ? `${detail.dailyReward.encountersPlayed} encounters today (${detail.dailyReward.utcDay})`
                : '—',
            },
            {
              label: 'Lore gems claimed',
              value:
                loreGemEntries.length > 0
                  ? `${loreGemEntries.length} entries`
                  : 'None',
            },
            {
              label: 'Currencies',
              value:
                currencyEntries.length > 0
                  ? currencyEntries
                      .map(([key, amount]) => `${key}: ${amount}`)
                      .join(', ')
                  : 'None',
            },
          ]}
        />
      </DetailSection>

      <DetailSection title={`Achievements (${detail.achievements.length})`}>
        {detail.achievements.length === 0 ? (
          <p className="text-sm text-fog">No achievement progress stored.</p>
        ) : (
          <ul className="space-y-2">
            {detail.achievements.map((achievement) => (
              <li
                key={achievement.achievementId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gold/10 bg-void/30 px-3 py-2 text-sm"
              >
                <span className="text-parchment">
                  {formatAchievementId(achievement.achievementId)}
                </span>
                <span className="text-xs text-fog">
                  Rank {achievement.rank} · {achievement.progress} progress
                  {achievement.unlockedAt
                    ? ` · unlocked ${formatRelative(achievement.unlockedAt)}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title={`Recent encounters (${detail.recentEncounters.length})`}>
        {detail.recentEncounters.length === 0 ? (
          <p className="text-sm text-fog">No encounter events in the event log.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {detail.recentEncounters.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-gold/10 bg-void/30 px-3 py-2 text-sm"
              >
                <p className="text-parchment">
                  {event.title ?? event.type}
                  {event.outcome ? (
                    <span className="text-fog"> · {event.outcome}</span>
                  ) : null}
                </p>
                <p className="text-xs text-fog">
                  {formatRelative(event.timestamp)}
                  {event.avatarId ? ` · avatar ${event.avatarId.slice(0, 8)}…` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </div>
  )
}

export function PlayerDetailPanel({ playerId, onClose }: PlayerDetailPanelProps) {
  const { data, error, isLoading, isError } = useQuery({
    queryKey: ['playerDetail', playerId],
    queryFn: () => fetchPlayerDetail(playerId),
    enabled: playerId.length > 0,
  })

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[1px]"
        aria-label="Close player details"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-gold/20 bg-slate shadow-2xl"
        role="dialog"
        aria-labelledby="player-detail-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            {isLoading ? (
              <h2 id="player-detail-title" className="text-lg text-parchment">
                Loading…
              </h2>
            ) : data ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="player-detail-title"
                    className="truncate text-lg font-medium text-gold-bright"
                  >
                    {data.summary.name}
                  </h2>
                  <StatusBadge value={data.summary.status} />
                </div>
                <p className="mt-1 text-xs text-fog">{data.playerId}</p>
              </>
            ) : (
              <h2 id="player-detail-title" className="text-lg text-parchment">
                Player not found
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-gold/20 px-2 py-1 text-xs text-fog hover:bg-ash/60 hover:text-parchment"
          >
            Close
          </button>
        </header>

        {data && (
          <div className="shrink-0 border-b border-gold/10 px-5 py-3">
            <PlayerModerationActions player={data.summary} />
          </div>
        )}

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
          {isLoading && (
            <p className="text-sm text-fog">Loading player data…</p>
          )}
          {isError && (
            <p className="text-sm text-red-300/90">
              {error instanceof Error ? error.message : 'Failed to load player'}
            </p>
          )}
          {data && <PlayerDetailContent detail={data} />}
          {isError && (
            <Link
              to="/players"
              className="mt-4 inline-block text-sm text-gold-bright hover:underline"
              onClick={onClose}
            >
              Back to list
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
