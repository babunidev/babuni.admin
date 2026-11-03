interface ConnectionBannerProps {
  title: string
  message: string
  hint?: string
}

export function ConnectionBanner({ title, message, hint }: ConnectionBannerProps) {
  return (
    <div
      className="mb-4 rounded-lg border border-ember/40 bg-ember/10 px-4 py-3 text-sm"
      role="alert"
    >
      <p className="font-medium text-red-300/95">{title}</p>
      <p className="mt-1 text-parchment/90">{message}</p>
      {hint && (
        <pre className="mt-3 overflow-x-auto rounded border border-gold/15 bg-void/60 p-3 text-xs text-gold-bright">
          {hint}
        </pre>
      )}
    </div>
  )
}
