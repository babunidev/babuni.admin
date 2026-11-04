import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../shared/components/PageHeader'

type ProjectId = 'morkahja' | 'babuni-dev'
type Kind = 'local-files' | 'postgres-ssh' | 'github' | 'remote-publish'
type ProfileState = 'not-configured' | 'available' | 'degraded' | 'error'
type CredentialState = 'not-required' | 'stored' | 'missing' | 'unavailable'
interface ContentReport {
  files: { name: string; status: string; entries?: number; bytes?: number; reason?: string }[]
}
interface Profile {
  id: string
  projectId: ProjectId
  displayName: string
  kind: Kind
  target: string
  state: ProfileState
  code?: string
  detail: string
  credential?: CredentialState
  checkedAt?: string
  lastSuccessAt?: string
}
interface Health {
  ok: boolean
  service: string
  mode: string
  keyring: 'available' | 'unavailable'
  checkedAt: string
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
async function api<T>(method = 'GET', path = '/', data?: unknown): Promise<T> {
  let result: Response
  try {
    result = await fetch('/local-connections-api' + path, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Babuni-Local': '1' },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
  } catch {
    throw new Error('LOCAL_SERVICE_UNAVAILABLE')
  }
  let value: { error?: string }
  try { value = await result.json() as { error?: string } }
  catch { throw new Error('INVALID_SERVICE_RESPONSE') }
  if (!result.ok) throw new Error(value.error || 'LOCAL_SERVICE_FAILURE')
  return value as unknown as T
}
function stateLabel(profile: Profile) {
  if (profile.state === 'available') return 'Available — local, read-only'
  if (profile.state === 'degraded') return 'Degraded — some content files are unavailable'
  if (profile.state === 'error') return 'Error — local check failed'
  return 'Not connected — profile only'
}
function checkedTime(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Not checked in this session'
}
function credentialLabel(value?: CredentialState) {
  if (value === 'stored') return 'Stored in Linux keyring'
  if (value === 'missing') return 'Not stored'
  if (value === 'unavailable') return 'Keyring unavailable'
  return 'Not required'
}

export function ConnectionsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [status, setStatus] = useState('Loading local connection profiles…')
  const [health, setHealth] = useState<Health | null>(null)
  const [projectId, setProjectId] = useState<ProjectId>('morkahja')
  const [kind, setKind] = useState<Kind>('local-files')
  const [displayName, setDisplayName] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [reports, setReports] = useState<Record<string, ContentReport>>({})

  async function reload() {
    try {
      const [data, service] = await Promise.all([
        api<{profiles: Profile[]}>(),
        api<Health>('GET', '/health'),
      ])
      setProfiles(data.profiles || [])
      setHealth(service)
      setStatus('Profiles are stored on this PC. No remote adapters are active.')
    } catch (error) {
      setHealth(null)
      setStatus(error instanceof Error ? error.message : 'LOCAL_SERVICE_UNAVAILABLE')
    }
  }
  useEffect(() => {
    void Promise.all([
      api<{profiles: Profile[]}>(),
      api<Health>('GET', '/health'),
    ]).then(([data, service]) => {
      setProfiles(data.profiles || [])
      setHealth(service)
      setStatus('Profiles are stored on this PC. No remote adapters are active.')
    }).catch(() => {
      setHealth(null)
      setStatus('LOCAL_SERVICE_UNAVAILABLE')
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
  async function testProfile(id: string) {
    setBusy(true)
    try { await api('POST', '/' + id + '/test'); await reload() }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to test connection') }
    finally { setBusy(false) }
  }
  async function inspect(id: string) {
    setBusy(true)
    try {
      const report = await api<ContentReport>('GET', '/' + id + '/inspect')
      setReports(old => ({...old, [id]: report}))
      await reload()
    } catch (error) {
      await reload()
      setStatus(error instanceof Error ? error.message : 'INSPECTION_FAILED')
    } finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true)
    try {
      await api('DELETE', '/' + id)
      setReports(old => {
        const next = {...old}
        delete next[id]
        return next
      })
      await reload()
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to remove') }
    finally { setBusy(false) }
  }

  const field = 'w-full rounded border border-gold/25 bg-ash px-3 py-2 text-parchment'
  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Connections" description="Private project profiles and read-only local directory checks. No remote access yet." />
    <p role="status" className="text-sm text-fog">{status}</p>
    <p className="text-xs text-fog">
      Local service: {health?.service === 'available' ? 'Available (loopback only)' : 'Not verified'}
      {' · '}OS keyring: {health?.keyring === 'available' ? 'Available' : 'Unavailable or not checked'}
      {' · '}Last service check: {checkedTime(health?.checkedAt)}
    </p>
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
          <span className="text-xs text-fog">Do not enter passwords, SSH keys or access tokens here. Remote profile credentials are stored separately using the terminal and Linux keyring.</span>
          <button type="submit" disabled={busy} className="rounded border border-gold/40 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50">Save profile</button>
        </div>
      </form>
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-widest text-gold-bright">Saved profiles ({profiles.length})</h2>
      {profiles.length === 0 && <p className="text-sm text-fog">No profiles configured.</p>}
      {profiles.map(p => <article key={p.id} className="rounded-lg border border-gold/15 bg-slate/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-parchment">{p.displayName}</h3>
            <p className="mt-1 break-all text-xs text-fog">{p.projectId} · {p.kind} · {p.target}</p>
            <p className="mt-2 text-xs text-fog">{stateLabel(p)}. {p.detail}</p>
            <p className="mt-1 text-xs text-fog">Result: {p.code || 'NOT_CHECKED'} · Checked: {checkedTime(p.checkedAt)}</p>
            {p.lastSuccessAt && <p className="mt-1 text-xs text-fog">Last complete successful check: {checkedTime(p.lastSuccessAt)}</p>}
            {p.kind !== 'local-files' && <p className="mt-1 text-xs text-fog">
              Credential: {credentialLabel(p.credential)} · ID: <code>{p.id}</code> · Transport not implemented
            </p>}
          </div>
          <div className="flex gap-2">
            {p.kind === 'local-files' && <button type="button" disabled={busy} onClick={()=>{ void inspect(p.id) }}>Inspect</button>}
            <button type="button" disabled={busy} onClick={()=>{ void testProfile(p.id) }} className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright disabled:opacity-50">Test</button>
            <button type="button" disabled={busy} onClick={()=>{ void remove(p.id) }} className="rounded border border-gold/20 px-3 py-1 text-xs text-fog disabled:opacity-50">Remove</button>
          </div>
        </div>
        {reports[p.id] && <section aria-label="Read-only content report" className="mt-3 border-t border-gold/10 pt-3">
          <h4 className="text-xs text-gold-bright">Game content — read-only</h4>
          <ul className="mt-2 space-y-1 text-xs text-fog">
            {reports[p.id].files.map(file => <li key={file.name}>{file.name}: {file.status === 'available'
              ? String(file.entries) + ' records, ' + String(file.bytes) + ' bytes'
              : 'Unavailable (' + file.reason + ')'}</li>)}
          </ul>
        </section>}
      </article>)}
    </section>
  </div>
}
