import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Spinner } from '../../../shared/components/Working'
import { PageHeader } from '../../../shared/components/PageHeader'
import {
  checkPull, checkSite, describeSiteError, loadSources, publishSite, pushSnapshot, writePull,
  type PullResult, type PushResult, type SiteResult, type SourcesResponse,
} from '../services/portfolioSite'

const button = 'rounded border border-gold/30 px-3 py-1 text-sm text-fog disabled:opacity-50'
const strong = 'rounded border border-gold bg-gold/10 px-3 py-1 text-sm text-gold-bright disabled:opacity-50'

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="max-w-3xl rounded-lg border border-gold/15 bg-slate/50 p-5">
      <h2 className="text-base font-medium text-gold-bright">{number}. {title}</h2>
      <div className="mt-3 space-y-3 text-sm text-fog">{children}</div>
    </section>
  )
}

const kindClass = (kind: string) =>
  kind === 'REMOVED' ? 'text-red-300' : kind === 'NEW' || kind === 'ADDED' ? 'text-gold-bright' : 'text-fog'

export function RepositoriesPage() {
  const [info, setInfo] = useState<SourcesResponse | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState('all')
  const [pull, setPull] = useState<PullResult | null>(null)
  const [acceptRemovals, setAcceptRemovals] = useState(false)
  const [confirmWrite, setConfirmWrite] = useState(false)
  const [push, setPush] = useState<PushResult | null>(null)
  const [confirmPush, setConfirmPush] = useState(false)
  const [site, setSite] = useState<SiteResult | null>(null)
  const [confirmSite, setConfirmSite] = useState(false)

  const refresh = useCallback(() => loadSources()
    .then(setInfo)
    .catch((e: Error) => setError(describeSiteError(e.message))), [])
  useEffect(() => { void refresh() }, [refresh])

  async function run<T extends { ok: boolean; error?: string }>(name: string, task: () => Promise<T>, done: (r: T) => void) {
    setBusy(name)
    setError(null)
    try {
      const result = await task()
      done(result)
      if (!result.ok && result.error) setError(describeSiteError(result.error))
    } catch (e) {
      setError(describeSiteError((e as Error).message))
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  const state = info?.state
  const working = busy !== null
  const pullChanged = pull?.ok && !pull.write && pull.changedCount > 0
  const canPush = state && (state.snapshotDirty || (state.ahead > 0 && state.aheadOnlySnapshot))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repositories"
        description="Bring document changes from the other connected repositories to www.babuni.dev"
      />
      <p className="max-w-3xl text-sm text-fog">
        Documents from other repositories reach the website through the pinned snapshot in the babuni.dev
        repository. Pull the changes into the snapshot, commit and push that one file, then build and publish
        the site. Each step checks first and asks for confirmation. The previous release stays on the server.
      </p>
      {error && <p role="alert" className="max-w-3xl rounded border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-red-300/90">{error}</p>}
      {working && <p role="status" className="flex items-center gap-2 text-sm text-gold-bright"><Spinner />Working… a site build can take several minutes.</p>}

      <Step number={1} title="Pull document changes">
        <div className="flex flex-wrap items-center gap-3">
          <select value={target} disabled={working}
            onChange={e => { setTarget(e.target.value); setPull(null); setConfirmWrite(false); setAcceptRemovals(false) }}
            className="rounded border border-gold/30 bg-slate px-2 py-1 text-sm text-fog">
            <option value="all">All {info?.sources.length ?? ''} connected repositories</option>
            {info?.sources.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" className={button} disabled={working}
            onClick={() => run('pull-check', () => checkPull(target), r => {
              setPull(r); setConfirmWrite(false); setAcceptRemovals(false)
            })}>
            Check
          </button>
        </div>
        {pull && (
          <div className="space-y-2">
            <p>{pull.write
              ? (pull.written ? `Snapshot updated for ${pull.changedCount} repositories.` : 'Nothing was written.')
              : pull.summary ?? ''}</p>
            <ul className="space-y-2">
              {pull.repositories.filter(r => r.changed).map(r => (
                <li key={r.repository}>
                  <span className="font-mono text-gold-bright">{r.repository}</span>
                  <span className="ml-2 font-mono text-xs">{r.from} → {r.to}</span>
                  <ul className="ml-4 font-mono text-xs">
                    {r.changes.map(c => (
                      <li key={c.kind + c.path} className={kindClass(c.kind)}>{c.kind.padEnd(8)} {c.path}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        {pullChanged && pull.removedCount > 0 && (
          <label className="flex items-start gap-2 text-red-300/90">
            <input type="checkbox" checked={acceptRemovals} onChange={e => setAcceptRemovals(e.target.checked)} />
            <span>{pull.removedCount} document(s) will be removed from the website. I confirm the removals are intended.</span>
          </label>
        )}
        {pullChanged && !confirmWrite && (
          <button type="button" className={button} disabled={working || (pull.removedCount > 0 && !acceptRemovals)}
            onClick={() => setConfirmWrite(true)}>
            Update snapshot…
          </button>
        )}
        {pullChanged && confirmWrite && (
          <button type="button" className={strong} disabled={working || (pull.removedCount > 0 && !acceptRemovals)}
            onClick={() => run('pull-write', () => writePull(target, acceptRemovals), setPull)}>
            Confirm: write {pull.changedCount} repositories into the snapshot
          </button>
        )}
      </Step>

      <Step number={2} title="Commit and push the snapshot">
        {state && (
          <p>
            Checkout on <span className="font-mono">{state.branch || 'detached HEAD'}</span> at{' '}
            <span className="font-mono">{state.head}</span>, origin/main{' '}
            <span className="font-mono">{state.originMain}</span>.{' '}
            {state.snapshotDirty ? 'The snapshot has uncommitted changes.' : 'The snapshot is committed.'}
            {state.ahead > 0 && ` ${state.ahead} local commit(s) not pushed.`}
            {state.behind > 0 && ` ${state.behind} commit(s) behind origin/main.`}
            {!state.fetched && ' (GitHub could not be reached; showing the last fetch.)'}
          </p>
        )}
        <p>Only <span className="font-mono">src/content/repository-documents.json</span> is committed. Other changes in the checkout are left alone.</p>
        {push?.ok && <p className="text-gold-bright">Pushed commit {push.commit} to origin/main.</p>}
        {canPush && !confirmPush && (
          <button type="button" className={button} disabled={working} onClick={() => setConfirmPush(true)}>
            Commit and push…
          </button>
        )}
        {canPush && confirmPush && (
          <button type="button" className={strong} disabled={working}
            onClick={() => run('push', pushSnapshot, r => { setPush(r); setConfirmPush(false); setSite(null) })}>
            Confirm: commit the snapshot and push to origin/main
          </button>
        )}
      </Step>

      <Step number={3} title="Publish the site">
        <p>Builds the committed origin/main in a temporary copy, compares it with the live site and publishes only the files that differ.</p>
        <button type="button" className={button} disabled={working}
          onClick={() => run('site-check', checkSite, r => { setSite(r); setConfirmSite(false) })}>
          Dry run
        </button>
        {site && (
          <div className="space-y-2">
            {site.commit && <p>Built origin/main <span className="font-mono">{site.commit}</span>; live release <span className="font-mono">{site.liveRelease}</span>{site.buildFiles !== null && `, ${site.buildFiles} files`}.</p>}
            {site.published && <p className="text-gold-bright">Published and verified: <span className="font-mono">{site.newRelease}</span></p>}
            {site.nothing && <p>The live site already matches origin/main. Nothing to publish.</p>}
            {site.total > 0 && (
              <>
                <p>{site.total} path(s) differ: {site.counts.CHANGED} changed, {site.counts.ADDED} added, {site.counts.REMOVED} removed.</p>
                <ul className="max-h-64 overflow-auto rounded border border-gold/15 p-2 font-mono text-xs">
                  {site.changes.map(c => <li key={c.kind + c.path} className={kindClass(c.kind)}>{c.kind.padEnd(8)} {c.path}</li>)}
                  {site.truncated && <li>… {site.total - site.changes.length} more</li>}
                </ul>
              </>
            )}
            {site.rollback && <p>Rollback: <span className="font-mono text-xs">{site.rollback}</span></p>}
          </div>
        )}
        {site?.ok && !site.apply && site.total > 0 && !confirmSite && (
          <button type="button" className={button} disabled={working} onClick={() => setConfirmSite(true)}>
            Publish…
          </button>
        )}
        {site?.ok && !site.apply && site.total > 0 && confirmSite && (
          <button type="button" className={strong} disabled={working}
            onClick={() => run('site-publish', publishSite, r => { setSite(r); setConfirmSite(false) })}>
            Confirm: publish {site.commit} to www.babuni.dev
          </button>
        )}
      </Step>
    </div>
  )
}
