interface StatCardProps {
  label: string
  value: string | number
  hint?: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <article className="rounded-lg border border-gold/15 bg-slate/80 p-4 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-widest text-fog">{label}</p>
      <p className="mt-2 text-2xl font-medium text-parchment">{value}</p>
      {hint && <p className="mt-1 text-xs text-fog/80">{hint}</p>}
    </article>
  )
}
