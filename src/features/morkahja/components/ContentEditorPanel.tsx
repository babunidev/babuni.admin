import { useId, type ReactNode } from 'react'

interface ContentEditorPanelProps {
  /** Dialog heading, e.g. "Edit solution" or "Add portrait". */
  title: string
  subtitle?: ReactNode
  saveLabel: string
  isSaving: boolean
  saveError?: string | null
  /** Shown above the save button, e.g. when a new ID would replace an existing entry. */
  warning?: string | null
  onSave: () => void
  onClose: () => void
  children: ReactNode
}

/**
 * Slide-over editor shared by solutions, expansions, frames and portraits.
 * Same layout as the encounter editor: scrolling form, save button pinned
 * at the bottom, save errors shown in place.
 */
export function ContentEditorPanel({
  title,
  subtitle,
  saveLabel,
  isSaving,
  saveError,
  warning,
  onSave,
  onClose,
  children,
}: ContentEditorPanelProps) {
  const titleId = useId()
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[1px]"
        aria-label="Close editor"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-gold/20 bg-slate shadow-2xl"
        role="dialog"
        aria-labelledby={titleId}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-medium text-gold-bright">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-fog">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-gold/20 px-2 py-1 text-xs text-fog hover:bg-ash/60 hover:text-parchment"
          >
            Close
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">{children}</div>
        </div>

        <footer className="shrink-0 border-t border-gold/15 px-5 py-4">
          {warning && (
            <p className="mb-3 text-xs text-amber-300/90">{warning}</p>
          )}
          {saveError && (
            <p role="alert" className="mb-3 text-sm text-red-300">
              Save failed: {saveError}
            </p>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="w-full rounded border border-gold/30 bg-gold/15 px-4 py-2.5 text-sm font-medium text-gold-bright transition hover:bg-gold/25 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : saveLabel}
          </button>
        </footer>
      </aside>
    </>
  )
}
