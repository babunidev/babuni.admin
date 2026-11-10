import { useEffect, useState } from 'react'
import { describeSiteError, loadDocumentDiff, type DocumentDiff } from '../services/portfolioSite'

const lineClass: Record<string, string> = {
  '+': 'bg-gold/10 text-gold-bright',
  '-': 'bg-ember/10 text-red-300/90',
  '@': 'text-fog/60',
  ' ': 'text-fog',
}

/** The website's version of one document against its repository's current version. */
export function DocumentDiffView({ repository, path }: { repository: string; path: string }) {
  const [diff, setDiff] = useState<DocumentDiff | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadDocumentDiff(repository, path)
      .then(value => { if (active) setDiff(value) })
      .catch((e: Error) => { if (active) setError(describeSiteError(e.message)) })
    return () => { active = false }
  }, [repository, path])

  if (error) return <p className="my-1 text-red-300/90">{error}</p>
  if (!diff) return <p className="my-1">Loading changes…</p>
  if (diff.binary) return <p className="my-1">An image; there is no text to compare.</p>
  return (
    <div className="my-2 rounded border border-gold/15 bg-black/20">
      <p className="border-b border-gold/15 px-3 py-1 font-sans">
        <span className="text-gold-bright">+{diff.added}</span> <span className="text-red-300/90">−{diff.removed}</span> lines,
        {' '}website version against {diff.branch} at {diff.commit}.
        {diff.movedSinceCheck && ' The repository has new commits since the check; check again before publishing.'}
      </p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs leading-relaxed">
        {diff.lines?.map((line, i) => (
          <div key={i} className={lineClass[line.t]}>{line.t === '@' ? line.s : `${line.t} ${line.s}`}</div>
        ))}
      </pre>
      {diff.truncated && <p className="px-3 py-1">Only the first 3000 lines are shown.</p>}
    </div>
  )
}
