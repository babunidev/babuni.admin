/** Small gold ring that turns while something is running. Decorative: the
 * text next to it says what is happening. */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true"
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-gold/25 border-t-gold-bright align-[-2px] motion-safe:animate-spin motion-reduce:animate-pulse ${className}`} />
  )
}

/** A thin light that sweeps along the top edge of a panel while it works.
 * The panel needs `relative overflow-hidden`. */
export function WorkingBar({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-gold/10">
      <span className="working-sweep block h-full w-1/3 bg-gradient-to-r from-transparent via-gold-bright to-transparent" />
    </span>
  )
}
