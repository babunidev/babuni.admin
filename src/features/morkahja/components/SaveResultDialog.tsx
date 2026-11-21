import { useEffect, useRef, useState } from 'react'

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

/** Pause before the first check, so the popup has faded in. */
const FIRST_CHECK_MS = 450
/** Pause between two checks that are ready at the same time. */
const NEXT_CHECK_MS = 380

/** How long the popup takes to fade out before it is gone. */
const CLOSE_MS = 260

const finished = (step: SaveStep) => step.state !== 'pending' && step.state !== 'working'

/**
 * Centered result of one save or upload. It fades in with every step listed,
 * an hourglass on the one in progress. Finished steps are checked off one at
 * a time from the top, even when several finish together, each mark settling
 * in softly. Once all are checked off, clicking beside it, pressing Escape or
 * the Close button fades it out, and then it is gone.
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
  /** How many steps, from the top, are shown as finished. */
  const [revealed, setRevealed] = useState(0)
  const [shownOpen, setShownOpen] = useState(open)
  /** Fading out after Close; the parent is told once the fade is over. */
  const [leaving, setLeaving] = useState(false)
  /** The heading the popup opened with, kept until the last check. */
  const [openingTitle, setOpeningTitle] = useState(result?.title ?? '')
  if (shownOpen !== open) {
    setShownOpen(open)
    if (open) {
      setRevealed(0)
      setLeaving(false)
      setOpeningTitle(result?.title ?? '')
    }
  }
  const steps = result?.steps ?? []
  const checked = Math.min(revealed, steps.length)
  const nextReady = checked < steps.length && finished(steps[checked])
  const busy = open && checked < steps.length

  useEffect(() => {
    if (!nextReady) return
    const timer = window.setTimeout(() => setRevealed(checked + 1), checked === 0 ? FIRST_CHECK_MS : NEXT_CHECK_MS)
    return () => window.clearTimeout(timer)
  }, [nextReady, checked])

  // The parent may pass a new onClose each render; that must not restart the fade.
  const latestOnClose = useRef(onClose)
  useEffect(() => { latestOnClose.current = onClose })
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => latestOnClose.current(), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])
  const close = () => setLeaving(true)

  useEffect(() => {
    if (!open || busy) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLeaving(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy])

  if (!result) return null
  const failed = steps.some((step) => step.state === 'failed')
  const allFailed = steps.every((step) => step.state === 'failed')

  /** One hourglass at most: the first step not yet checked off. */
  const shownState = (step: SaveStep, index: number): SaveStepState => {
    if (index < checked) return step.state
    if (index === checked && step.state !== 'pending') return 'working'
    return 'pending'
  }

  return (
    <div
      className={`${leaving ? 'save-backdrop-out pointer-events-none' : 'save-backdrop-in'} fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-[2px]`}
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-result-title"
        aria-busy={busy}
        className={`${leaving ? 'save-card-out' : 'save-card-in'} w-full max-w-lg rounded-lg border bg-slate p-6 shadow-2xl shadow-black/60 transition-colors duration-700 ${
          busy ? 'border-gold/30' : allFailed ? 'border-red-400/40' : failed ? 'border-amber-400/40' : 'border-gold/30'
        }`}
      >
        <p key={busy ? 'busy' : 'done'} className="save-text-in text-xs uppercase tracking-widest text-fog" aria-live="polite">
          {busy ? 'Saving…' : allFailed ? 'Not saved' : failed ? 'Partly done' : 'All done'}
        </p>
        <h2 key={busy ? openingTitle : result.title} id="save-result-title" className="save-text-in mt-1 font-serif text-xl text-gold-bright">
          {busy ? openingTitle : result.title}
        </h2>
        {result.subtitle && !busy && <p className="save-text-in mt-1 text-sm text-fog">{result.subtitle}</p>}

        <ol className="mt-5 space-y-4">
          {steps.map((step, index) => {
            const state = shownState(step, index)
            const mark = marks[state]
            const done = state === 'ok' || state === 'failed' || state === 'skipped'
            // Finished, but its check is still to come.
            const waiting = finished(step) && !done
            return (
              <li
                // By position, so the list stays put while the save fills it in.
                key={index}
                className="save-step-in flex gap-3"
                style={{ animationDelay: `${120 + index * 70}ms` }}
              >
                <span
                  key={state}
                  aria-label={mark.word}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm transition-colors duration-500 ${mark.className} ${
                    state === 'ok' ? 'save-ring' : ''
                  }`}
                >
                  <span className={done ? 'save-mark-in' : state === 'working' ? 'save-text-in' : ''}>{mark.glyph}</span>
                </span>
                <div className="min-w-0">
                  <p className={`text-sm transition-colors duration-500 ${state === 'pending' ? 'text-fog' : 'text-parchment'}`}>
                    {step.label}
                  </p>
                  {/* A finished step's text waits faintly and lights up with its check. */}
                  <div className={`transition-opacity duration-700 ${waiting ? 'opacity-30' : 'opacity-100'}`}>
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
                </div>
              </li>
            )
          })}
        </ol>

        {result.notes && result.notes.length > 0 && !busy && (
          <ul className="save-text-in mt-5 space-y-1 border-t border-gold/10 pt-4 text-xs text-fog">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            disabled={busy}
            className={`rounded border border-gold/30 bg-gold/15 px-4 py-1.5 text-sm text-gold-bright transition-[opacity,transform,background-color,box-shadow] duration-150 ease-out hover:bg-gold/25 hover:shadow-[0_0_12px_-2px] hover:shadow-gold/40 active:scale-95 active:bg-gold/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60 disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-gold/15 disabled:hover:shadow-none disabled:active:scale-100 ${
              leaving ? 'scale-95 bg-gold/35' : ''
            }`}
          >
            {busy ? 'Working…' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
