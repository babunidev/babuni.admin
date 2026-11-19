import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../../shared/components/PageHeader'
import { Markdown } from '../../../shared/components/Markdown'
import { Spinner, WorkingBar } from '../../../shared/components/Working'
import {
  KEY_DOCUMENTS, describeProjectError, keyDocument, loadProjectDocument, loadProjectDocuments, loadProjects,
  type Project, type ProjectDocument, type ProjectDocumentList, type ProjectOverview,
} from '../services/projects'

const ago = (days: number | null | undefined) =>
  days == null ? 'no date' : days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
const shortDate = (iso: string) => iso.slice(0, 10)

/** Most recently worked on first; the one asking for revision is pinned above the list. */
function ordered(projects: Project[]) {
  const connected = projects.filter(p => p.repository && !p.needsRevision)
    .sort((a, b) => (b.lastWorkedOn ?? '').localeCompare(a.lastWorkedOn ?? '') || a.name.localeCompare(b.name))
  return { connected, waiting: projects.filter(p => !p.repository) }
}

export function ProjectsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Every state update happens in a promise callback, after its request returns.
  function load(refresh: boolean, isActive: () => boolean = () => true) {
    return loadProjects(refresh)
      .then(value => { if (isActive()) { setOverview(value); setError(null) } })
      .catch((e: Error) => { if (isActive()) setError(describeProjectError(e.message)) })
      .finally(() => { if (isActive()) setLoading(false) })
  }
  useEffect(() => {
    let active = true
    void load(false, () => active)
    return () => { active = false }
  }, [])

  const projects = useMemo(() => overview?.projects ?? [], [overview])
  const revision = projects.find(p => p.needsRevision) ?? null
  const { connected, waiting } = useMemo(() => ordered(projects), [projects])
  const selected = projects.find(p => p.id === projectId) ?? revision ?? null

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every project on www.babuni.dev, with its latest work read live from GitHub. Read-only."
        action={
          <button type="button" onClick={() => { setLoading(true); void load(true) }} disabled={loading}
            className="inline-flex items-center gap-2 rounded border border-gold/25 px-3 py-1.5 text-sm text-parchment transition hover:border-gold/50 disabled:opacity-60">
            {loading && <Spinner />}{loading ? 'Reading GitHub…' : 'Refresh'}
          </button>
        }
      />
      {error && <p role="alert" className="mb-4 max-w-3xl rounded border border-red-400/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</p>}
      {overview && (
        <p className="mb-4 text-xs text-fog">
          {projects.length} projects · read {new Date(overview.checkedAt).toLocaleString()}{overview.cached ? ' (from the last read)' : ''}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="Projects" className="relative min-w-0">
          <WorkingBar active={loading && !overview} />
          {revision && (
            <div className="mb-4">
              <p className="mb-1.5 text-[10px] uppercase tracking-widest text-ember">Asks for revision</p>
              <ProjectRow project={revision} active={selected?.id === revision.id} onSelect={() => navigate(`/projects/${revision.id}`)} />
            </div>
          )}
          <ul className="space-y-1">
            {connected.map(p => (
              <li key={p.id}>
                <ProjectRow project={p} active={selected?.id === p.id} onSelect={() => navigate(`/projects/${p.id}`)} />
              </li>
            ))}
          </ul>
          {waiting.length > 0 && (
            <>
              <p className="mb-1.5 mt-5 text-[10px] uppercase tracking-widest text-fog/70">No repository connected</p>
              <ul className="space-y-1">
                {waiting.map(p => (
                  <li key={p.id}>
                    <ProjectRow project={p} active={selected?.id === p.id} onSelect={() => navigate(`/projects/${p.id}`)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
        {selected ? <ProjectDetail key={selected.id} project={selected} /> : !loading && !error && (
          <p className="text-sm text-fog">No project selected.</p>
        )}
      </div>
    </div>
  )
}

function ProjectRow({ project, active, onSelect }: { project: Project; active: boolean; onSelect: () => void }) {
  const revision = project.needsRevision
  return (
    <button type="button" onClick={onSelect} aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
        revision
          ? `border-ember/70 bg-ember/15 shadow-[0_0_18px_-6px_var(--color-ember)] ${active ? 'ring-1 ring-ember' : 'hover:bg-ember/25'}`
          : active ? 'border-gold/30 bg-gold/15' : 'border-transparent hover:bg-ash/80'
      }`}>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: project.tint ?? 'var(--color-mist)' }} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${active ? 'text-gold-bright' : 'text-parchment'}`}>{project.name}</span>
        <span className="block truncate text-[11px] text-fog">
          {project.repository ? (project.readError ? describeProjectError(project.readError) : ago(project.daysSince)) : project.status.replace(/-/g, ' ')}
        </span>
      </span>
    </button>
  )
}

function ProjectDetail({ project }: { project: Project }) {
  const [list, setList] = useState<ProjectDocumentList | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [doc, setDoc] = useState<ProjectDocument | null>(null)
  const [docPath, setDocPath] = useState<string | null>(null)
  const [docError, setDocError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const reader = useRef<HTMLElement>(null)
  useEffect(() => { if (docPath) reader.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [docPath])

  useEffect(() => {
    if (!project.repository) return
    let active = true
    loadProjectDocuments(project.id)
      .then(value => { if (active) setList(value) })
      .catch((e: Error) => { if (active) setListError(describeProjectError(e.message)) })
    return () => { active = false }
  }, [project.id, project.repository])

  function open(path: string) {
    if (docPath === path) { setDocPath(null); setDoc(null); return }
    setDocPath(path)
    setDoc(null)
    setDocError(null)
    loadProjectDocument(project.id, path)
      .then(value => setDoc(value))
      .catch((e: Error) => setDocError(describeProjectError(e.message)))
  }

  const paths = list?.documents.map(d => d.path) ?? []
  const keys = KEY_DOCUMENTS.map(name => ({ name, path: keyDocument(paths, name) })).filter(k => k.path) as { name: string; path: string }[]
  const keyPaths = new Set(keys.map(k => k.path))
  const others = paths.filter(p => !keyPaths.has(p))

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-5">
        <section className={`rounded-lg border p-5 ${project.needsRevision ? 'border-ember/60 bg-ember/10' : 'border-gold/15 bg-slate/50'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-parchment">{project.name}</h2>
              {project.summary && <p className="mt-1 text-sm text-fog">{project.summary}</p>}
            </div>
            {project.url && (
              <a href={project.url} target="_blank" rel="noreferrer noopener"
                className="shrink-0 rounded border border-gold/20 px-2.5 py-1 text-xs text-gold-bright hover:border-gold/50">
                {project.repository} ↗
              </a>
            )}
          </div>
          {project.repository ? (
            <p className="mt-3 text-sm text-parchment/85">
              Last worked on <strong className="text-gold-bright">{project.lastWorkedOn ?? 'unknown'}</strong>
              {' '}({ago(project.daysSince)}, from its {project.lastWorkedFrom === 'changelog' ? 'changelog' : 'last commit'})
              {project.needsRevision && <span className="ml-2 text-ember">· the longest wait of all projects</span>}
            </p>
          ) : (
            <p className="mt-3 text-sm text-fog">This project is on the website but has no connected repository ({project.status.replace(/-/g, ' ')}).</p>
          )}
          {project.readError && <p className="mt-2 text-sm text-red-300">{describeProjectError(project.readError)}</p>}
        </section>

        {project.changelog && (
          <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
            <p className="text-[10px] uppercase tracking-widest text-fog">Latest changelog entry · {project.changelog.date}</p>
            {project.changelog.title && <h3 className="mt-1 text-base font-medium text-gold-bright">{project.changelog.title}</h3>}
            <div className="mt-2"><Markdown text={project.changelog.body} /></div>
          </section>
        )}

        {project.commits && project.commits.length > 0 && (
          <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-fog">Last {project.commits.length} commits · {project.branch}</h3>
            <ul className="mt-3 divide-y divide-gold/10">
              {project.commits.map(c => (
                <li key={c.commit} className="flex items-baseline gap-3 py-2 text-sm">
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="shrink-0 font-mono text-xs text-gold hover:text-gold-bright">{c.commit}</a>
                  <span className="min-w-0 flex-1 text-parchment/90">{c.subject}</span>
                  <span className="shrink-0 text-xs text-fog">{shortDate(c.date)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {docPath && (
          <section ref={reader} aria-label={docPath} className="relative scroll-mt-4 rounded-lg border border-gold/25 bg-slate/60 p-5">
            <WorkingBar active={!doc && !docError} />
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-gold/10 pb-2">
              <p className="truncate font-mono text-xs text-gold-bright">{docPath}</p>
              <button type="button" onClick={() => open(docPath)} className="shrink-0 text-xs text-fog hover:text-parchment">Close ✕</button>
            </div>
            {docError && <p className="text-sm text-red-300">{docError}</p>}
            {!doc && !docError && <p className="flex items-center gap-2 text-sm text-fog"><Spinner /> Reading from GitHub…</p>}
            {doc && <Markdown text={doc.body} />}
          </section>
        )}
      </div>

      {project.repository && (
        <aside aria-label="Documents" className="min-w-0 space-y-2 xl:sticky xl:top-0 xl:self-start">
          <p className="text-[10px] uppercase tracking-widest text-fog">Documents</p>
          {listError && <p className="text-sm text-red-300">{listError}</p>}
          {!list && !listError && <p className="flex items-center gap-2 text-sm text-fog"><Spinner /> Listing…</p>}
          {keys.map(k => (
            <button key={k.path} type="button" onClick={() => open(k.path)}
              className={`block w-full rounded-lg border px-4 py-3 text-left transition ${
                docPath === k.path ? 'border-gold/50 bg-gold/15' : 'border-gold/15 bg-slate/50 hover:border-gold/40'}`}>
              <span className="block text-sm font-medium text-gold-bright">{k.name.charAt(0) + k.name.slice(1).toLowerCase()}</span>
              <span className="block truncate font-mono text-[11px] text-fog">{k.path}</span>
            </button>
          ))}
          {list && others.length > 0 && (
            <div className="rounded-lg border border-gold/15 bg-slate/50">
              <button type="button" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-parchment hover:text-gold-bright">
                All documents ({others.length}) <span aria-hidden className="text-fog">{showAll ? '▾' : '▸'}</span>
              </button>
              {showAll && (
                <ul className="scrollbar-thin max-h-96 overflow-y-auto border-t border-gold/10 px-2 py-2">
                  {others.map(path => (
                    <li key={path}>
                      <button type="button" onClick={() => open(path)}
                        className={`block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px] ${
                          docPath === path ? 'bg-gold/15 text-gold-bright' : 'text-fog hover:bg-ash hover:text-parchment'}`}>
                        {path}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {list && paths.length === 0 && <p className="text-sm text-fog">No Markdown documents in this repository.</p>}
          <p className="pt-2 text-[11px] leading-relaxed text-fog/80">
            Read live from GitHub, branch {project.branch}. Editing happens in the project itself.
          </p>
        </aside>
      )}
    </div>
  )
}
