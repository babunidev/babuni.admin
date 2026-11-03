import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../shared/components/PageHeader'

type ProjectId = 'morkahja' | 'babuni-dev'
type Kind = 'local-files' | 'postgres-ssh' | 'github' | 'remote-publish'
interface Profile {
  id: string
  projectId: ProjectId
  displayName: string
  kind: Kind
  target: string
  state: string
  detail: string
}
const kinds: Record<ProjectId, { value: Kind; label: string }[]> = {
  morkahja: [
    { value: 'local-files', label: 'Local files' },
    { value: 'postgres-ssh', label: 'PostgreSQL via SSH (planned)' },
  ],
  'babuni-dev': [
    { value: 'github', label: 'GitHub repository (planned)' },
    { value: 'remote-publish', label: 'Remote publishing (planned)' },
  ],
}
async function api(method = 'GET', path = '/', data?: unknown) {
  const result = await fetch('/local-connections-api' + path, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Babuni-Local': '1' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const value = await result.json() as { profiles?: Profile[]; error?: string }
  if (!result.ok) throw new Error(value.error || 'Local connection service unavailable')
  return value
}

export function ConnectionsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [status, setStatus] = useState('Loading local connection profiles…')
  const [projectId, setProjectId] = useState<ProjectId>('morkahja')
  const [kind, setKind] = useState<Kind>('local-files')
  const [displayName, setDisplayName] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  async function reload() {
    try {
      const data = await api()
      setProfiles(data.profiles || [])
      setStatus('Profiles stored on this PC. Connection adapters are not active yet.')
    } catch {
      setStatus('Local connection profiles are unavailable in this mode. Run npm run dev on this PC.')
    }
  }
  useEffect(() => {
    void api().then(data => {
      setProfiles(data.profiles || [])
      setStatus('Profiles stored on this PC. Connection adapters are not active yet.')
    }).catch(() => {
      setStatus('Local connection profiles are unavailable in this mode. Run npm run dev on this PC.')
    })
  }, [])
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      await api('POST', '/', { projectId, kind, displayName, target })
      setDisplayName('')
      setTarget('')
      await reload()
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to save') }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true)
    try { await api('DELETE', '/' + id); await reload() }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to remove') }
    finally { setBusy(false) }
  }

  const field = 'w-full rounded border border-gold/25 bg-ash px-3 py-2 text-parchment'
  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Connections" description="Private connection profiles for this PC; no live remote access yet." />
    <p role="status" className="text-sm text-fog">{status}</p>
    <section className="rounded-lg border border-gold/20 bg-slate/50 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-gold-bright">Add connection profile</h2>
      <form onSubmit={e => { void add(e) }} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-fog">Project
          <select className={field} value={projectId} onChange={e => {
            const next = e.target.value as ProjectId
            setProjectId(next)
            setKind(kinds[next][0].value)
          }}><option value="morkahja">Morkahja</option><option value="babuni-dev">Babuni Dev</option></select>
        </label>
        <label className="text-sm text-fog">Connection type
          <select className={field} value={kind} onChange={e => setKind(e.target.value as Kind)}>
            {kinds[projectId].map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-fog">Profile name
          <input className={field} required maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="My Morkahja files"/>
        </label>
        <label className="text-sm text-fog">Target (no credentials)
          <input className={field} required maxLength={250} value={target} onChange={e=>setTarget(e.target.value)}
            placeholder={kind==='local-files'?'/home/babuni/Projects/Morkahja/client/public':kind==='github'?'babunidev/babuni.admin':'host.example.com'} />
        </label>
        <div className="sm:col-span-2 flex items-center justify-between gap-4">
          <span className="text-xs text-fog">Do not enter passwords, SSH keys or access tokens.</span>
          <button type="submit" disabled={busy} className="rounded border border-gold/40 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50">Save profile</button>
        </div>
      </form>
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-widest text-gold-bright">Saved profiles ({profiles.length})</h2>
      {profiles.length === 0 && <p className="text-sm text-fog">No profiles configured.</p>}
      {profiles.map(p => <article key={p.id} className="rounded-lg border border-gold/15 bg-slate/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h3 className="text-parchment">{p.displayName}</h3><p className="mt-1 text-xs text-fog">{p.projectId} · {p.kind} · {p.target}</p>
            <p className="mt-2 text-xs text-fog">Not connected — profile only. No remote operation has been attempted.</p></div>
          <button type="button" disabled={busy} onClick={()=>{ void remove(p.id) }} className="rounded border border-gold/20 px-3 py-1 text-xs text-fog disabled:opacity-50">Remove</button>
        </div>
      </article>)}
    </section>
  </div>
}
