import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { banPlayer, timeoutPlayer, unbanPlayer } from '../services/adminApi'
import type { Player } from '../types'
import { StatusBadge } from './StatusBadge'

const timeoutOptions = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 1_440 },
  { label: '7 days', minutes: 10_080 },
]

interface PlayerModerationActionsProps {
  player: Player
}

export function PlayerModerationActions({ player }: PlayerModerationActionsProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<'timeout' | 'ban' | null>(null)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(60)
  const [message, setMessage] = useState<string | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['players'] })
    void queryClient.invalidateQueries({ queryKey: ['playerDetail', player.id] })
    void queryClient.invalidateQueries({ queryKey: ['onlinePlayers'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    void queryClient.invalidateQueries({ queryKey: ['activityFeed'] })
  }

  const timeoutMutation = useMutation({
    mutationFn: () =>
      timeoutPlayer({
        playerId: player.id,
        durationMinutes: duration,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      setMessage(result.message)
      setOpen(null)
      setReason('')
      invalidate()
    },
  })

  const banMutation = useMutation({
    mutationFn: () =>
      banPlayer({
        playerId: player.id,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      setMessage(result.message)
      setOpen(null)
      setReason('')
      invalidate()
    },
  })

  const unbanMutation = useMutation({
    mutationFn: () => unbanPlayer(player.id),
    onSuccess: (result) => {
      setMessage(result.message)
      invalidate()
    },
  })

  const busy =
    timeoutMutation.isPending || banMutation.isPending || unbanMutation.isPending

  return (
    <div className="flex flex-wrap items-center gap-2">
      {player.status === 'online' && player.isOnline && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen('timeout')}
            className="rounded border border-gold/25 px-2 py-1 text-xs text-gold-bright transition hover:border-gold/50 hover:bg-gold/10 disabled:opacity-50"
          >
            Timeout
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen('ban')}
            className="rounded border border-ember/40 px-2 py-1 text-xs text-red-300/90 transition hover:bg-ember/10 disabled:opacity-50"
          >
            Ban
          </button>
        </>
      )}
      {player.status === 'banned' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => unbanMutation.mutate()}
          className="rounded border border-gold/25 px-2 py-1 text-xs text-parchment transition hover:bg-ash disabled:opacity-50"
        >
          Unban
        </button>
      )}
      {player.status === 'timed_out' && (
        <StatusBadge value="timed_out" label="Active" />
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-void/80 p-4">
          <div
            className="w-full max-w-md rounded-lg border border-gold/20 bg-slate p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mod-title"
          >
            <h3 id="mod-title" className="text-lg text-parchment">
              {open === 'timeout' ? `Timeout ${player.name}` : `Ban ${player.name}`}
            </h3>
            <p className="mt-1 text-sm text-fog">
              {open === 'timeout'
                ? 'Disconnect the player for a set duration.'
                : 'Permanently block this account until unbanned.'}
            </p>

            {open === 'timeout' && (
              <label className="mt-4 block text-sm text-fog">
                Duration
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gold/20 bg-ash px-3 py-2 text-parchment"
                >
                  {timeoutOptions.map((opt) => (
                    <option key={opt.minutes} value={opt.minutes}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="mt-4 block text-sm text-fog">
              Reason (optional)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gold/20 bg-ash px-3 py-2 text-sm text-parchment"
                placeholder="Moderation note…"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded border border-mist/40 px-3 py-1.5 text-sm text-fog"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  open === 'timeout'
                    ? timeoutMutation.mutate()
                    : banMutation.mutate()
                }
                className="rounded border border-gold/30 bg-gold/15 px-3 py-1.5 text-sm text-gold-bright disabled:opacity-50"
              >
                {busy ? 'Applying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <span className="w-full text-xs text-fog" role="status">
          {message}
        </span>
      )}
    </div>
  )
}
