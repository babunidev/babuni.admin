import { capitalize } from '../utils/format'

const toneMap: Record<string, string> = {
  online: 'bg-emerald-950/50 text-emerald-300/90 border-emerald-800/40',
  offline: 'bg-ash text-fog border-mist/30',
  banned: 'bg-ember/20 text-red-300/90 border-ember/50',
  muted: 'bg-gold-dim/30 text-gold-bright border-gold/30',
  open: 'bg-arcane/30 text-parchment border-arcane/50',
  reviewing: 'bg-gold-dim/40 text-gold-bright border-gold/40',
  resolved: 'bg-emerald-950/40 text-emerald-300/80 border-emerald-800/30',
  dismissed: 'bg-ash text-fog border-mist/30',
  info: 'bg-arcane/25 text-parchment border-arcane/40',
  warn: 'bg-gold-dim/35 text-gold-bright border-gold/35',
  error: 'bg-ember/25 text-red-300/90 border-ember/45',
  audit: 'bg-slate text-gold-bright border-gold/25',
  degraded: 'bg-gold-dim/35 text-gold-bright border-gold/40',
  up: 'text-emerald-400/90',
  down: 'text-red-400/80',
  stable: 'text-fog',
}

interface StatusBadgeProps {
  value: string
  className?: string
}

export function StatusBadge({ value, className = '' }: StatusBadgeProps) {
  const tone = toneMap[value] ?? 'bg-ash text-fog border-mist/30'
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs tracking-wide ${tone} ${className}`}
    >
      {capitalize(value)}
    </span>
  )
}
