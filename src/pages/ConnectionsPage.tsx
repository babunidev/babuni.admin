import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../shared/components/PageHeader'
import { localConnectionApi as api } from '../shared/services/localConnectionClient'

type ProjectId = 'morkahja' | 'babuni-dev'
type Kind = 'local-files' | 'postgres-ssh' | 'github' | 'remote-publish'
type ProfileState = 'not-configured' | 'available' | 'connected' | 'disconnected' | 'degraded' | 'error'
type CredentialState = 'not-required' | 'stored' | 'missing' | 'locked' | 'unavailable'
interface ContentReport {
  files: {name:string;status:string;entries?:number;bytes?:number;reason?:string}[]
}
interface Profile {
  id:string
  projectId:ProjectId
  displayName:string
  kind:Kind
  target:string
  state:ProfileState
  code?:string
  detail:string
  capabilities?:string[]
  credential?:CredentialState
  checkedAt?:string
  lastSuccessAt?:string
}
interface Health {
  ok:boolean
  service:string
  mode:string
  keyring:'available'|'locked'|'unavailable'
  checkedAt:string
}
const kinds:Record<ProjectId,{value:Kind;label:string}[]> = {
  morkahja:[
    {value:'local-files',label:'Local files'},
    {value:'postgres-ssh',label:'PostgreSQL via SSH (operator-enabled health check)'},
  ],
  'babuni-dev':[
    {value:'github',label:'GitHub repository (planned)'},
    {value:'remote-publish',label:'Remote publishing (planned)'},
  ],
}

function stateLabel(profile:Profile) {
  if (profile.state==='connected') return 'Connected — local read-only session'
  if (profile.state==='available') return 'Available — local check only'
  if (profile.state==='disconnected') return profile.code==='REMOTE_DB_HEALTHY_READ_ONLY'?'Remote health checked — tunnel closed':'Disconnected'
  if (profile.state==='degraded') return 'Degraded — some content is unavailable'
  if (profile.state==='error') return 'Error — local check failed'
  return 'Not connected — profile only'
}
function checkedTime(value?:string) {
  return value?new Date(value).toLocaleString():'Not checked in this session'
}
function credentialLabel(value?:CredentialState) {
  if (value==='stored') return 'Stored in Linux keyring'
  if (value==='missing') return 'Not stored'
  if (value==='locked') return 'Keyring locked — unlock required'
  if (value==='unavailable') return 'Keyring unavailable'
  return 'Not required'
}

export function ConnectionsPage() {
  const [profiles,setProfiles]=useState<Profile[]>([])
  const [status,setStatus]=useState('Loading local connection profiles…')
  const [health,setHealth]=useState<Health|null>(null)
  const [projectId,setProjectId]=useState<ProjectId>('morkahja')
  const [kind,setKind]=useState<Kind>('local-files')
  const [displayName,setDisplayName]=useState('')
  const [target,setTarget]=useState('')
  const [busy,setBusy]=useState(false)
  const [reports,setReports]=useState<Record<string,ContentReport>>({})
  const [editingId,setEditingId]=useState<string|null>(null)
  const [editName,setEditName]=useState('')
  const [editTarget,setEditTarget]=useState('')

  async function reload() {
    try {
      const [data,service]=await Promise.all([
        api<{profiles:Profile[]}>(),api<Health>('GET','/health'),
      ])
      setProfiles(data.profiles||[])
      setHealth(service)
      setStatus('Profiles are stored on this PC. SSH health and approved read-only access are separate from editing.')
    } catch(error) {
      setProfiles([])
      setHealth(null)
      setStatus(error instanceof Error?error.message:'LOCAL_SERVICE_UNAVAILABLE')
    }
  }
  useEffect(()=>{
    void Promise.all([api<{profiles:Profile[]}>(),api<Health>('GET','/health')])
      .then(([data,service])=>{
        setProfiles(data.profiles||[])
        setHealth(service)
        setStatus('Profiles are stored on this PC. SSH health and approved read-only access are separate from editing.')
      })
      .catch(()=>{setHealth(null);setStatus('LOCAL_SERVICE_UNAVAILABLE')})
  },[])

  async function operation(action:()=>Promise<unknown>) {
    setBusy(true)
    try { await action();await reload() }
    catch(error) {
      await reload()
      setStatus(error instanceof Error?error.message:'LOCAL_SERVICE_FAILURE')
    } finally {setBusy(false)}
  }
  async function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await operation(async()=>{
      await api('POST','/',{projectId,kind,displayName,target})
      setDisplayName('')
      setTarget('')
    })
  }
  async function saveEdit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingId) return
    const id=editingId
    await operation(async()=>{
      await api('PUT','/'+id,{displayName:editName,target:editTarget})
      setReports(old=>{const next={...old};delete next[id];return next})
      setEditingId(null)
    })
  }
  function beginEdit(profile:Profile) {
    setEditingId(profile.id)
    setEditName(profile.displayName)
    setEditTarget(profile.target)
  }
  async function inspect(id:string) {
    await operation(async()=>{
      const report=await api<ContentReport>('GET','/'+id+'/inspect')
      setReports(old=>({...old,[id]:report}))
    })
  }
  async function remove(id:string) {
    await operation(async()=>{
      await api('DELETE','/'+id)
      setReports(old=>{const next={...old};delete next[id];return next})
      if(editingId===id)setEditingId(null)
    })
  }

  const field='w-full rounded border border-gold/25 bg-ash px-3 py-2 text-parchment'
  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Connections" description="Private connections. Remote SSH/PostgreSQL health checks require a separate operator-only configuration and are disabled by default; no live editing."/>
    <p role="status" className="text-sm text-fog">{status}</p>
    <p className="text-xs text-fog">
      Local service: {health?.service==='available'?'Available (loopback only)':'Not verified'}
      {' · '}OS keyring: {health?.keyring==='available'?'Responding (not a credential round-trip)':health?.keyring==='locked'?'Locked (credential access denied)':'Unavailable or not checked'}
      {' · '}Last service check: {checkedTime(health?.checkedAt)}
    </p>
    <section className="rounded-lg border border-gold/20 bg-slate/50 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-gold-bright">Add connection profile</h2>
      <form onSubmit={e=>{void add(e)}} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-fog">Project
          <select className={field} value={projectId} onChange={e=>{
            const next=e.target.value as ProjectId
            setProjectId(next);setKind(kinds[next][0].value)
          }}><option value="morkahja">Morkahja</option><option value="babuni-dev">Babuni Dev</option></select>
        </label>
        <label className="text-sm text-fog">Connection type
          <select className={field} value={kind} onChange={e=>setKind(e.target.value as Kind)}>
            {kinds[projectId].map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-fog">Profile name
          <input className={field} required maxLength={80} value={displayName}
            onChange={e=>setDisplayName(e.target.value)} placeholder="My Morkahja files"/>
        </label>
        <label className="text-sm text-fog">Target (no credentials)
          <input className={field} required maxLength={250} value={target} onChange={e=>setTarget(e.target.value)}
            placeholder={kind==='local-files'?'/home/babuni/Projects/Morkahja/client/public':kind==='github'?'babunidev/babuni.admin':'host.example.com'}/>
        </label>
        <div className="sm:col-span-2 flex items-center justify-between gap-4">
          <span className="text-xs text-fog">No passwords, SSH keys or tokens in this form. Remote credentials are managed separately in the Linux keyring.</span>
          <button type="submit" disabled={busy} className="rounded border border-gold/40 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50">Save profile</button>
        </div>
      </form>
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-widest text-gold-bright">Saved profiles ({profiles.length})</h2>
      {profiles.length===0 && <p className="text-sm text-fog">No profiles configured.</p>}
      {profiles.map(p=><article key={p.id} className="rounded-lg border border-gold/15 bg-slate/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-parchment">{p.displayName}</h3>
            <p className="mt-1 break-all text-xs text-fog">{p.projectId} · {p.kind} · {p.target}</p>
            <p className="mt-2 text-xs text-fog">{stateLabel(p)}. {p.detail}</p>
            <p className="mt-1 text-xs text-fog">Result: {p.code||'NOT_CHECKED'} · Checked: {checkedTime(p.checkedAt)}</p>
            {p.lastSuccessAt && <p className="mt-1 text-xs text-fog">Last successful check: {checkedTime(p.lastSuccessAt)}</p>}
            {p.kind!=='local-files' && <p className="mt-1 text-xs text-fog">
              Credential: {credentialLabel(p.credential)} · ID: <code>{p.id}</code> · No persistent connection or write permission
            </p>}
            <p className="mt-1 text-xs text-fog">Allowed operations: {p.capabilities?.join(', ')||'None (adapter planned)'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={()=>beginEdit(p)}
              className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright disabled:opacity-50">Edit</button>
            {p.capabilities?.includes('local:inspect') &&
              <button type="button" disabled={busy} onClick={()=>{void inspect(p.id)}}>Inspect</button>}
            <button type="button" disabled={busy} onClick={()=>{
              void operation(()=>api('POST','/'+p.id+'/test'))
            }} className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright disabled:opacity-50">{p.capabilities?.includes('ssh:preflight')?'Check pinned key (offline)':'Test'}</button>
            {p.capabilities?.includes('ssh:probe') &&
              <button type="button" disabled={busy} onClick={()=>{
                void operation(()=>api('POST','/'+p.id+'/probe'))
              }} className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright disabled:opacity-50">Probe SSH + DB (opt-in)</button>}
            {p.capabilities?.includes('local:connect') &&
              (p.state==='connected'
                ? <button type="button" disabled={busy} onClick={()=>{
                  void operation(()=>api('POST','/'+p.id+'/disconnect'))
                }} className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright disabled:opacity-50">Disconnect</button>
                : <button type="button" disabled={busy} onClick={()=>{
                  void operation(()=>api('POST','/'+p.id+(p.state==='disconnected'?'/reconnect':'/connect')))
                }} className="rounded border border-gold/20 px-3 py-1 text-xs text-gold-bright disabled:opacity-50">{p.state==='disconnected'?'Reconnect':'Connect'}</button>)}
            <button type="button" disabled={busy} onClick={()=>{void remove(p.id)}}
              className="rounded border border-gold/20 px-3 py-1 text-xs text-fog disabled:opacity-50">Remove</button>
          </div>
        </div>
        {editingId===p.id && <form onSubmit={e=>{void saveEdit(e)}}
          className="mt-4 grid gap-3 border-t border-gold/10 pt-3 sm:grid-cols-2"
          aria-label={'Edit '+p.displayName}>
          <label className="text-xs text-fog">Profile name
            <input className={field} required maxLength={80} value={editName} onChange={e=>setEditName(e.target.value)}/>
          </label>
          <label className="text-xs text-fog">Target (no credentials)
            <input className={field} required maxLength={250} value={editTarget} onChange={e=>setEditTarget(e.target.value)}/>
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={busy} className="rounded border border-gold/40 px-3 py-1 text-xs text-gold-bright">Save changes</button>
            <button type="button" disabled={busy} onClick={()=>setEditingId(null)}
              className="rounded border border-gold/20 px-3 py-1 text-xs text-fog">Cancel</button>
          </div>
          <p className="text-xs text-fog sm:col-span-2">Project and adapter cannot be changed. Editing the target clears the previous connection check.</p>
        </form>}
        {reports[p.id] && <section aria-label="Read-only content report" className="mt-3 border-t border-gold/10 pt-3">
          <h4 className="text-xs text-gold-bright">Game content — read-only</h4>
          <ul className="mt-2 space-y-1 text-xs text-fog">
            {reports[p.id].files.map(file=><li key={file.name}>{file.name}: {file.status==='available'
              ? String(file.entries)+' records, '+String(file.bytes)+' bytes'
              : 'Unavailable ('+file.reason+')'}</li>)}
          </ul>
        </section>}
      </article>)}
    </section>
  </div>
}
