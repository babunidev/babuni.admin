import type { ReactNode } from 'react'

export interface ContentDetailField {
  label: string
  value: string
}

interface ContentDetailPanelProps {
  title: string
  subtitle?: string
  imageSrc?: string
  imageClassName?: string
  children?: ReactNode
  fields?: ContentDetailField[]
  textSection?: { title: string; body: string }
  rawJson?: object
  onClose: () => void
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
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

export function ContentDetailPanel({
  title,
  subtitle,
  imageSrc,
  imageClassName = 'max-h-56 w-full rounded-lg border border-gold/15 object-contain',
  children,
  fields = [],
  textSection,
  rawJson,
  onClose,
}: ContentDetailPanelProps) {
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[1px]"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-gold/20 bg-slate shadow-2xl"
        role="dialog"
        aria-labelledby="content-detail-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="content-detail-title"
              className="truncate text-lg font-medium text-gold-bright"
            >
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
          <div className="space-y-6">
            {imageSrc && (
              <img src={imageSrc} alt="" className={imageClassName} />
            )}
            {textSection && (
              <DetailSection title={textSection.title}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-parchment/95">
                  {textSection.body || (
                    <span className="text-fog">No text.</span>
                  )}
                </p>
              </DetailSection>
            )}
            {fields.length > 0 && (
              <DetailSection title="Details">
                <dl className="grid gap-2 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div
                      key={field.label}
                      className="rounded-md border border-gold/10 bg-void/40 px-3 py-2"
                    >
                      <dt className="text-[10px] uppercase tracking-wider text-fog">
                        {field.label}
                      </dt>
                      <dd className="mt-0.5 text-sm text-parchment">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </DetailSection>
            )}
            {children}
            {rawJson && (
              <DetailSection title="Raw JSON">
                <pre className="overflow-x-auto rounded border border-gold/10 bg-void/50 p-3 text-[11px] leading-relaxed text-parchment/80">
                  {JSON.stringify(rawJson, null, 2)}
                </pre>
              </DetailSection>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
