import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../shared/components/PageHeader'
import { localConnectionApi as api } from '../shared/services/localConnectionClient'
import { activateMorkahjaConnection } from '../shared/services/morkahjaConnection'

interface Profile {
  id: string
  projectId: string
  kind: string
  displayName: string
  target: string
  state: string
  code?: string
  detail: string
  credential?: 'not-required'|'stored'|'missing'|'locked'|'unavailable'
  capabilities?: string[]
  checkedAt?: string
  lastSuccessAt?: string
}
interface Health {
  service: string
  keyring: 'available'|'locked'|'unavailable'
  checkedAt: string
}

const button='rounded border border-gold/30 px-3 py-2 text-sm text-gold-bright disabled:opacity-50'
const field='w-full rounded border border-gold/25 bg-ash px-3 py-2 text-parchment'
function checked(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Not yet checked'
}
function credentialLabel(value?:Profile['credential']) {
  if(value==='stored')return 'Password stored in Linux keyring'
  if(value==='locked')return 'Linux keyring locked'
  if(value==='missing')return 'Database password missing from Linux keyring'
  return 'Credential unavailable or not checked'
}

export function ConnectionsPage() {
  const [profiles,setProfiles]=useState<Profile[]>([])
  const [health,setHealth]=useState<Health|null>(null)
  const [status,setStatus]=useState('Loading connection…')
  const [busy,setBusy]=useState(false)
  const [editing,setEditing]=useState(false)
  const [name,setName]=useState('Morkahja administrator')
  const [target,setTarget]=useState('')
  const [probeStatus,setProbeStatus]=useState('')
  const [loaded,setLoaded]=useState(false)

  async function reload() {
    try {
      const [result,service]=await Promise.all([
        api<{profiles:Profile[]}>(),api<Health>('GET','/health'),
      ])
      setProfiles(result.profiles)
      setHealth(service)
      activateMorkahjaConnection(result.profiles)
      setLoaded(true)
      setStatus('Administrator connection details are managed here.')
    } catch(error) {
      setLoaded(true)
      setStatus(error instanceof Error?error.message:'LOCAL_SERVICE_UNAVAILABLE')
    }
  }
  useEffect(()=>{
    void reload()
  },[])

  const adminProfiles=profiles.filter(p=>
    p.projectId==='morkahja' && p.kind==='postgres-ssh-moderation')
  const active=adminProfiles.length===1 ? adminProfiles[0] : adminProfiles.find(p=>{
    try{return p.id===window.localStorage.getItem('babuni-admin:morkahja:moderation-profile')}
    catch{return false}
  })
  const legacy=profiles.filter(p=>p.id!==active?.id)
  async function operation(action:()=>Promise<void>) {
    setBusy(true)
    try {await action();await reload()}
    catch(error){setStatus(error instanceof Error?error.message:'CONNECTION_OPERATION_FAILED')}
    finally{setBusy(false)}
  }
  function beginEdit(profile:Profile) {
    setName(profile.displayName)
    setTarget(profile.target)
    setEditing(true)
  }
  async function create(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await operation(async()=>{
      await api('POST','/',{
        projectId:'morkahja',kind:'postgres-ssh-moderation',
        displayName:name,target,
      })
      setEditing(false)
    })
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(!active)return
    await operation(async()=>{
      await api('PUT','/'+active.id,{displayName:name,target})
      setEditing(false)
    })
  }
  async function checkHost(profile:Profile) {
    await operation(async()=>{
      const result=await api<{status:{code:string}}>('POST','/'+profile.id+'/test')
      setProbeStatus(result.status.code)
    })
  }
  async function checkDatabase(profile:Profile) {
    await operation(async()=>{
      const result=await api<{ok:boolean;data:{players:number;avatars:number}}>(
        'POST','/'+profile.id+'/read-overview')
      setProbeStatus(result.ok
        ? 'Database accessible · '+result.data.players+' players · '+result.data.avatars+' avatars'
        : 'Database access failed')
    })
  }

  return <div className="max-w-4xl space-y-6">
    <PageHeader title="Connection"
      description="Your server connection, credentials and connection checks. Overview, Moderation and Content use this connection automatically." />
    <p className="text-sm text-fog" role="status">{status}</p>
    <p className="text-xs text-fog">
      Local service: {health?.service==='available'?'Running on this PC':'Unavailable'}
      {' · '}Keyring: {health?.keyring || 'not checked'}
      {' · '}Checked: {checked(health?.checkedAt)}
    </p>

    {active ? <section className="space-y-4 rounded-lg border border-gold/20 bg-slate/50 p-5" aria-label="Morkahja administrator connection">
      <div>
        <h2 className="text-lg font-medium text-parchment">{active.displayName}</h2>
        <p className="mt-1 text-xs text-fog">The configured connection for Morkahja.</p>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-fog">Server</dt><dd className="break-all text-parchment">{active.target}</dd></div>
        <div><dt className="text-fog">Database</dt><dd className="text-parchment">morkahja · babuni_admin</dd></div>
        <div><dt className="text-fog">Credential</dt><dd className="text-parchment">{credentialLabel(active.credential)}</dd></div>
        <div><dt className="text-fog">Last successful request</dt><dd className="text-parchment">{checked(active.lastSuccessAt)}</dd></div>
        <div className="sm:col-span-2"><dt className="text-fog">Access</dt><dd className="text-parchment">Overview, player Moderation, and content catalogs</dd></div>
      </dl>
      <p className="text-xs text-fog">Connection status: {active.code || 'NOT_CHECKED'}. {active.detail}</p>
      {probeStatus && <p className="text-sm text-gold-bright" role="status">{probeStatus}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={()=>{void checkHost(active)}}>Check SSH host</button>
        <button className={button} disabled={busy} onClick={()=>{void checkDatabase(active)}}>Test database read</button>
        <button className={button} disabled={busy} onClick={()=>beginEdit(active)}>Edit server details</button>
      </div>
      {editing && <form aria-label="Edit administrator connection" onSubmit={e=>{void save(e)}} className="grid gap-3 border-t border-gold/15 pt-4 sm:grid-cols-2">
        <label className="text-sm text-fog">Connection name
          <input className={field} required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/>
        </label>
        <label className="text-sm text-fog">Server host
          <input className={field} required maxLength={250} value={target} onChange={e=>setTarget(e.target.value)}/>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button className={button} type="submit" disabled={busy}>Save changes</button>
          <button className={button} type="button" onClick={()=>setEditing(false)}>Cancel</button>
        </div>
      </form>}
      <p className="text-xs text-fog">SSH identity and PostgreSQL connection settings stay in your private configuration. Your database password stays in the Linux keyring. This page never displays either secret.</p>
    </section> : loaded ? <section className="space-y-4 rounded-lg border border-gold/20 bg-slate/50 p-5">
      <h2 className="text-lg font-medium text-parchment">Set up Morkahja connection</h2>
      <p className="text-sm text-fog">One administrator profile supplies Morkahja's Overview, Moderation and Content. Existing SSH and database settings must also be configured privately.</p>
      <form onSubmit={e=>{void create(e)}} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-fog">Connection name
          <input className={field} required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/>
        </label>
        <label className="text-sm text-fog">Server host
          <input className={field} required maxLength={250} value={target} onChange={e=>setTarget(e.target.value)} placeholder="server.example.com"/>
        </label>
        <button className={button} disabled={busy} type="submit">Save connection</button>
      </form>
    </section> : null}

    {adminProfiles.length>1 && <p role="alert" className="text-sm text-fog">
      Multiple administrator profiles exist. Keep the active one and remove redundant profiles during cleanup; automatic selection is paused until one is chosen.
    </p>}
    {legacy.length>0 && <details className="rounded-lg border border-gold/15 bg-slate/50 p-4">
      <summary className="cursor-pointer text-sm text-fog">Previous and unused profiles ({legacy.length})</summary>
      <p className="mt-2 text-xs text-fog">Retained for migration. They are not used when your administrator connection is available. No credentials are deleted automatically.</p>
      {legacy.map(profile=><div key={profile.id} className="mt-3 border-t border-gold/10 pt-3 text-sm">
        <p className="text-parchment">{profile.displayName}</p>
        <p className="text-xs text-fog">{profile.kind} · {profile.target}</p>
      </div>)}
    </details>}
    <p className="text-xs text-fog">babuni.dev publishing is not yet connected through this interface. The Morkahja administrator connection is working independently.</p>
  </div>
}
