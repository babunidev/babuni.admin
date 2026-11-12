import { useState } from 'react'
import {
  checkReleases, cleanupReleases, describeSiteError, type ReleaseCleanup, type ReleasePlan,
} from '../services/portfolioSite'
import { Spinner, WorkingBar } from '../../../shared/components/Working'

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

/** Old website releases on the server: check, then remove what the check listed.
 * The live release, the one before it and the newest five always stay. */
export function ReleaseCleanupPanel() {
  const [busy, setBusy] = useState<'check' | 'remove' | null>(null)
  const [plan, setPlan] = useState<ReleasePlan | null>(null)
  const [done, setDone] = useState<ReleaseCleanup | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'check' | 'remove') {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'check') { setDone(null); setPlan(await checkReleases()) }
      else { setPlan(null); setDone(await cleanupReleases()) }
    } catch (e) {
      setError(describeSiteError((e as Error).message))
      if (kind === 'remove') setPlan(null)
    } finally { setBusy(null) }
  }

  const removable = plan?.remove.length ?? 0
  return (
    <section aria-busy={busy !== null}
      className="relative mt-6 max-w-4xl overflow-hidden rounded-lg border border-gold/15 bg-slate/50 p-5">
      <WorkingBar active={busy !== null} />
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex-1 text-base font-medium text-gold-bright">Old releases on the server</h2>
        <button type="button" disabled={busy !== null} onClick={() => void run('check')}
          className="rounded border border-gold/30 px-3 py-1 text-sm text-fog disabled:opacity-50">
          {busy === 'check' ? <><Spinner className="mr-1.5" />Checking…</> : 'Check'}
        </button>
        {removable > 0 && (
          <button type="button" disabled={busy !== null} onClick={() => void run('remove')}
            className="rounded border border-gold bg-gold/10 px-4 py-1 text-sm text-gold-bright disabled:opacity-40">
            {busy === 'remove' ? <><Spinner className="mr-1.5" />Removing…</> : `Remove ${removable} old release${removable === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm text-fog">
        {!plan && !done && !error && (
          <p>Every publish keeps a copy of the site on the server. This removes old copies; the live release, the one before it (for rollback) and the newest five always stay.</p>
        )}
        {error && <p role="alert" className="text-red-300/90">{error}</p>}
        {plan && (
          <>
            <p>
              Live: <span className="font-mono">{plan.current}</span>.
              {' '}{plan.keep.length} release(s) stay.
              {removable === 0 ? ' Nothing to remove.' : ` Removing ${removable} frees about ${megabytes(plan.freedBytes)}.`}
            </p>
            {removable > 0 && (
              <ul className="font-mono text-xs text-red-300/90">
                {plan.remove.map(name => <li key={name}>{name}</li>)}
              </ul>
            )}
            {plan.other.length > 0 && (
              <p>
                {plan.other.length} older folder(s) with other names are never removed here:
                {' '}<span className="font-mono text-xs">{plan.other.join(', ')}</span>
              </p>
            )}
          </>
        )}
        {done && (
          <p className="text-gold-bright">
            Removed {done.removed.length} old release(s), about {megabytes(done.freedBytes)}. Live release {done.current} untouched.
          </p>
        )}
      </div>
    </section>
  )
}
