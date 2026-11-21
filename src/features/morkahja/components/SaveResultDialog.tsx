import { useEffect, useRef } from 'react'

/** `pending` and `working` show a save that is still running. */
export type SaveStepState = 'ok' | 'failed' | 'skipped' | 'pending' | 'working'

export interface SaveStep {
  /** Stable key while a running save updates the step in place. */
  id?: string
  label: string
  state: SaveStepState
  detail: string
  href?: string
  hrefLabel?: string
}

export interface SaveResult {
  title: string
  subtitle?: string
  steps: SaveStep[]
  notes?: string[]
}

const marks: Record<SaveStepState, { glyph: string; className: string; word: string }> = {
  ok: { glyph: '✓', className: 'border-emerald-400/40 text-emerald-300', word: 'Done' },
  failed: { glyph: '✕', className: 'border-red-400/50 text-red-300', word: 'Failed' },
  skipped: { glyph: '–', className: 'border-fog/40 text-fog', word: 'Nothing to do' },
  pending: { glyph: '', className: 'border-fog/25 text-fog/50', word: 'Waiting' },
  working: { glyph: '⧗', className: 'border-gold/50 text-gold-bright animate-pulse', word: 'Working' },
}

/**
 * Centered result of one save or upload. While the save runs, every step is
 * listed with an hourglass on the one in progress, and each turns into its
 * check mark as the server reports it. Once nothing is running, clicking
 * beside it, pressing Escape or the Close button dismisses it.
 */
export function SaveResultDialog({
  result,
  onClose,
}: {
  result: SaveResult | null
  onClose: () => void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const open = result !== null
  const running = Boolean(result?.steps.some((step) => step.state === 'pending' || step.state === 'working'))

  useEffect(() => {
    if (!open || running) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, running, onClose])

  if (!result) return null
  const failed = result.steps.some((step) => step.state === 'failed')
  const allFailed = result.steps.every((step) => step.state === 'failed')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (!running && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-result-title"
        aria-busy={running}
        className={`w-full max-w-lg rounded-lg border bg-slate p-6 shadow-2xl shadow-black/60 ${
          allFailed ? 'border-red-400/40' : failed ? 'border-amber-400/40' : 'border-gold/30'
        }`}
      >
        <p className="text-xs uppercase tracking-widest text-fog" aria-live="polite">
          {running ? 'Saving…' : allFailed ? 'Not saved' : failed ? 'Partly done' : 'All done'}
        </p>
        <h2 id="save-result-title" className="mt-1 font-serif text-xl text-gold-bright">
          {result.title}
        </h2>
        {result.subtitle && <p className="mt-1 text-sm text-fog">{result.subtitle}</p>}

        <ol className="mt-5 space-y-4">
          {result.steps.map((step) => {
            const mark = marks[step.state]
            return (
              <li key={step.id ?? step.label} className="flex gap-3">
                <span
                  aria-label={mark.word}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm transition-colors duration-300 ${mark.className}`}
                >
                  {mark.glyph}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm ${step.state === 'pending' ? 'text-fog' : 'text-parchment'}`}>{step.label}</p>
                  <p className="mt-0.5 break-words text-sm text-fog">{step.detail}</p>
                  {step.href && (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block break-all text-xs text-gold-bright underline decoration-gold/40 underline-offset-2 hover:decoration-gold"
                    >
                      {step.hrefLabel ?? step.href}
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {result.notes && result.notes.length > 0 && (
          <ul className="mt-5 space-y-1 border-t border-gold/10 pt-4 text-xs text-fog">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            disabled={running}
            className="rounded border border-gold/30 bg-gold/15 px-4 py-1.5 text-sm text-gold-bright hover:bg-gold/25 disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-gold/15"
          >
            {running ? 'Working…' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
