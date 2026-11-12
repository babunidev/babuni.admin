import { useCallback, useEffect, useState } from 'react'
import {
  describeSiteError, loadChanges, loadSiteStatus, publishEverything,
  type PublishAllResult, type RepositoryChanges, type SiteStatus,
} from '../services/portfolioSite'
import { DocumentDiffView } from './DocumentDiffView'
import { Spinner, WorkingBar } from '../../../shared/components/Working'

const kindClass = (kind: string) =>
  kind === 'REMOVED' ? 'text-red-300/90' : kind === 'NEW' ? 'text-gold-bright' : 'text-fog'

/** Opens with an automatic check of the live site, the website repository and
 * every connected repository; one click publishes everything that is waiting. */
export function PublishPanel() {
  const [site, setSite] = useState<SiteStatus | null>(null)
  const [siteError, setSiteError] = useState<string | null>(null)
  const [changes, setChanges] = useState<RepositoryChanges | null>(null)
  const [changesError, setChangesError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<PublishAllResult | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  // Every state update happens in a promise callback, after its request returns.
  const load = useCallback((refresh: boolean, isActive: () => boolean = () => true) => {
    loadSiteStatus()
      .then(value => { if (isActive()) { setSite(value); setSiteError(null) } })
      .catch((e: Error) => { if (isActive()) setSiteError(describeSiteError(e.message)) })
    return loadChanges(refresh)
      .then(value => {
        if (!isActive()) return
        setChanges(value)
        setChangesError(!value.ok && value.error ? describeSiteError(value.error) : null)
      })
      .catch((e: Error) => { if (isActive()) setChangesError(describeSiteError(e.message)) })
      .finally(() => { if (isActive()) setChecking(false) })
  }, [])
  useEffect(() => {
    let active = true
    void load(false, () => active)
    return () => { active = false }
  }, [load])

  function check(refresh: boolean) {
    setChecking(true)
    return load(refresh)
  }

  async function publish() {
    setPublishing(true)
    setPublishError(null)
    setResult(null)
    try {
      setOpen(null)
      const value = await publishEverything((changes?.removedCount ?? 0) > 0)
      setResult(value)
      if (!value.ok && value.error) setPublishError(describeSiteError(value.error))
    } catch (e) {
      setPublishError(describeSiteError((e as Error).message))
    } finally {
      setPublishing(false)
      void check(true)
    }
  }

  const changed = changes?.ok ? changes.repositories.filter(r => r.changed) : []
  const pendingCommits = site?.pendingCommits ?? []
  const somethingWaiting = changed.length > 0 || (site !== null && !site.upToDate)
  const blocked = site?.state.snapshotDirty === true
  const canPublish = !checking && !publishing && changes?.ok === true && site !== null && somethingWaiting && !blocked
  const notOnWebsite = changes?.notOnWebsite ?? []

  let headline = 'Checking…'
  if (publishing) headline = 'Publishing… the site build takes several minutes.'
  else if (!checking && blocked) headline = 'Publishing is paused while other work in babuni.dev is unfinished.'
  else if (!checking && site && changes?.ok) headline = somethingWaiting ? 'Changes are waiting to be published.' : 'Everything is live.'
  else if (!checking && (siteError || changesError)) headline = 'The check did not finish.'

  return (
    <section aria-busy={checking || publishing}
      className="relative max-w-4xl overflow-hidden rounded-lg border border-gold/15 bg-slate/50 p-5">
      <WorkingBar active={checking || publishing} />
      <div className="flex flex-wrap items-center gap-3">
        <h2 role="status" className="flex flex-1 items-center gap-2 text-base font-medium text-gold-bright">
          {(checking || publishing) && <Spinner />}{headline}
        </h2>
        <button type="button" disabled={checking || publishing} onClick={() => void check(true)}
          className="rounded border border-gold/30 px-3 py-1 text-sm text-fog disabled:opacity-50">
          {checking && !publishing ? 'Checking…' : 'Check again'}
        </button>
        <button type="button" disabled={!canPublish} onClick={() => void publish()}
          className="rounded border border-gold bg-gold/10 px-4 py-1 text-sm text-gold-bright disabled:opacity-40">
          {publishing ? 'Publishing…' : 'Publish everything'}
        </button>
      </div>

      <div className="mt-4 space-y-4 text-sm text-fog">
        {publishError && <p role="alert" className="rounded border border-ember/30 bg-ember/10 px-3 py-2 text-red-300/90">{publishError}</p>}
        {result?.ok && result.steps.site && (
          <p className="text-gold-bright">
            {result.steps.site.published
              ? `Published and verified: ${result.steps.site.newRelease} (${result.steps.site.total} files changed).`
              : 'The live site already matched; nothing needed publishing.'}
            {result.steps.push?.commit && ` Snapshot commit ${result.steps.push.commit} pushed.`}
          </p>
        )}
        {result?.steps.site?.rollback && <p>Rollback: <span className="font-mono text-xs">{result.steps.site.rollback}</span></p>}

        <div>
          <h3 className="text-parchment">Live website</h3>
          {siteError && <p>{siteError}</p>}
          {site && (
            <p>
              {site.live
                ? <>Release <span className="font-mono">{site.live.name}</span>{site.live.kind === 'doc' && ' (a single-document publish; a full publish brings everything else)'}.</>
                : 'The live release could not be read.'}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-parchment">Website repository (babuni.dev)</h3>
          {site && pendingCommits.length === 0 && !site.snapshotWaiting && <p>No unpublished commits on main.</p>}
          {blocked && (
            <p className="text-red-300/90">
              The document snapshot in the babuni.dev checkout has uncommitted changes from other work there.
              Publish everything never commits someone else&apos;s unfinished changes; commit and push that work first, then check again.
            </p>
          )}
          {site?.snapshotWaiting && !blocked && <p>A snapshot commit is waiting to be pushed and published.</p>}
          {pendingCommits.length > 0 && (
            <ul className="font-mono text-xs">
              {pendingCommits.map(c => <li key={c.commit}>{c.commit} {c.subject}</li>)}
            </ul>
          )}
          {site && site.state.otherDirty > 0 && (
            <p>{site.state.otherDirty} uncommitted file(s) in the babuni.dev checkout. They are not published until committed and pushed.</p>
          )}
        </div>

        <div>
          <h3 className="text-parchment">Connected repositories</h3>
          {checking && (
            <p className="flex items-center gap-2"><Spinner />
              {changes ? 'Checking again…' : 'Asking GitHub about every connected repository… this takes a minute or two.'}
            </p>
          )}
          {changesError && <p>{changesError}</p>}
          {changes?.ok && (
            <p>
              {changed.length === 0 ? `No document changes in ${changes.repositories.length} repositories.`
                : `${changed.length} of ${changes.repositories.length} repositories have document changes.`}
              {' '}Checked {new Date(changes.checkedAt).toLocaleTimeString()}.
            </p>
          )}
          {changed.length > 0 && (
            <ul className="mt-2 space-y-2">
              {changed.map(r => (
                <li key={r.repository}>
                  <span className="font-mono text-gold-bright">{r.repository}</span>
                  <ul className="ml-4 font-mono text-xs">
                    {r.changes.map(c => {
                      const key = `${r.repository}:${c.path}`
                      return (
                        <li key={c.kind + c.path} className={kindClass(c.kind)}>
                          <button type="button" onClick={() => setOpen(open === key ? null : key)}
                            aria-expanded={open === key} className="text-left hover:underline">
                            {c.kind.padEnd(8)} {c.path}
                          </button>
                          {open === key && <DocumentDiffView repository={r.repository} path={c.path} />}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {changed.length > 0 && <p className="mt-1 text-xs">Click a document to see what changed.</p>}
          {(changes?.removedCount ?? 0) > 0 && (
            <p className="mt-2 text-red-300/90">{changes?.removedCount} document(s) shown in red will be removed from the website when you publish.</p>
          )}
        </div>

        {notOnWebsite.length > 0 && (
          <div>
            <h3 className="text-parchment">On GitHub but not on the website</h3>
            <ul className="font-mono text-xs">
              {notOnWebsite.map(r => <li key={r.repository}>{r.repository}{r.private && ' (private)'}</li>)}
            </ul>
            <p className="mt-1">Adding a project to the website is done in the babuni.dev repository (project entry and tile).</p>
          </div>
        )}
      </div>
    </section>
  )
}
