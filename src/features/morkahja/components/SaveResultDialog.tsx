import { useEffect, useRef } from 'react'

export type SaveStepState = 'ok' | 'failed' | 'skipped'

export interface SaveStep {
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
}

/**
 * Centered result of one save or upload. Clicking beside it, pressing Escape
 * or the Close button dismisses it.
 */
export function SaveResultDialog({
  result,
  onClose,
}: {
  result: SaveResult | null
  onClose: () => void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!result) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, onClose])

  if (!result) return null
  const failed = result.steps.some((step) => step.state === 'failed')
  const allFailed = result.steps.every((step) => step.state === 'failed')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-result-title"
        className={`w-full max-w-lg rounded-lg border bg-slate p-6 shadow-2xl shadow-black/60 ${
          allFailed ? 'border-red-400/40' : failed ? 'border-amber-400/40' : 'border-gold/30'
        }`}
      >
        <p className="text-xs uppercase tracking-widest text-fog">
          {allFailed ? 'Not saved' : failed ? 'Partly done' : 'All done'}
        </p>
        <h2 id="save-result-title" className="mt-1 font-serif text-xl text-gold-bright">
          {result.title}
        </h2>
        {result.subtitle && <p className="mt-1 text-sm text-fog">{result.subtitle}</p>}

        <ol className="mt-5 space-y-4">
          {result.steps.map((step) => {
            const mark = marks[step.state]
            return (
              <li key={step.label} className="flex gap-3">
                <span
                  aria-label={mark.word}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${mark.className}`}
                >
                  {mark.glyph}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-parchment">{step.label}</p>
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
            className="rounded border border-gold/30 bg-gold/15 px-4 py-1.5 text-sm text-gold-bright hover:bg-gold/25"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
