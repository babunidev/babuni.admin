import { useEffect, useState } from 'react'
import { PageHeader } from '../../../shared/components/PageHeader'
import { StatCard } from '../components/StatCard'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'

interface ConnectionOption {
  id: string
  projectId: string
  kind: string
  displayName: string
  target: string
}
interface Overview {
  players: number
  avatars: number
  activeSessions: number
  eventsLast24h: number
}
interface PlayerPreview {
  displayName: string
  avatarCount: number
  lastPlayedAt: number | null
}
interface PlayerPage {
  page: number
  pageSize: number
  total: number
  players: PlayerPreview[]
}
interface ReadResponse<T> {
  ok: boolean
  checkedAt: string
  data: T
}

const border = 'rounded-lg border border-gold/20 bg-slate/50 p-4'
const button = 'rounded border border-gold/40 px-3 py-2 text-sm text-gold-bright disabled:opacity-40'
const checkedTime = (value: string) => new Date(value).toLocaleString()
const lastPlayed = (value: number | null) =>
  value === null ? 'Not recorded' : new Date(value).toLocaleString()

const readErrorHints: Record<string,string> = {
  DB_READ_PERMISSION_DENIED: 'The database role lacks SELECT permission on at least one required table. No permissions were changed.',
  DB_READ_TABLE_MISSING: 'A required table was not found in the configured database schema.',
  DB_READ_COLUMN_MISSING: 'The game database has a different column layout than the dashboard expects.',
  DB_READ_SCHEMA_MISMATCH: 'A database column or function is incompatible with the fixed read-only query.',
  DB_READ_INVALID_DATA: 'The fixed query encountered an unsupported database value.',
  DB_READ_TIMEOUT: 'The read-only query exceeded its time limit.',
  DB_READ_AUTH_FAILED: 'PostgreSQL did not accept the configured database login.',
  DB_READ_CONNECTION_FAILED: 'The temporary database connection could not be established or was interrupted.',
}
function readableFailure(error:unknown):string {
  const code=error instanceof Error ? error.message : 'REMOTE_READ_FAILED'
  return readErrorHints[code] ? code + ' — ' + readErrorHints[code] : code
}

export function ReadOnlyDashboardPage() {
  const [profiles, setProfiles] = useState<ConnectionOption[]>([])
  const [profileId, setProfileId] = useState('')
  const [overview, setOverview] = useState<ReadResponse<Overview> | null>(null)
  const [playerPage, setPlayerPage] = useState<ReadResponse<PlayerPage> | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Loading locally saved connection profiles…')

  useEffect(() => {
    let mounted = true
    void localConnectionApi<{profiles: ConnectionOption[]}>().then(result => {
      if (!mounted) return
      const eligible = result.profiles.filter(profile =>
        profile.projectId === 'morkahja' && profile.kind === 'postgres-ssh')
      setProfiles(eligible)
      setStatus(eligible.length > 0
        ? 'Choose a profile and request an explicit read-only snapshot.'
        : 'No Morkahja PostgreSQL/SSH profile is configured.')
    }).catch(error => {
      if (mounted) setStatus(error instanceof Error ? error.message : 'LOCAL_SERVICE_UNAVAILABLE')
    })
    return () => { mounted = false }
  }, [])

  async function loadOverview() {
    if (!profileId || busy) return
    setBusy(true)
    setStatus('Checking read-only authorization…')
    try {
      const result = await localConnectionApi<ReadResponse<Overview>>(
        'POST', '/' + profileId + '/read-overview')
      setOverview(result)
      setStatus('Overview retrieved using a temporary SSH tunnel. Disconnected.')
    } catch(error) {
      setOverview(null)
      setStatus(readableFailure(error))
    } finally {setBusy(false)}
  }

  async function loadPlayers(page: number) {
    if (!profileId || busy || page < 1 || page > 1000) return
    setBusy(true)
    setStatus('Checking approved player-preview fields…')
    try {
      const result = await localConnectionApi<ReadResponse<PlayerPage>>(
        'POST', '/' + profileId + '/read-players', {page})
      setPlayerPage(result)
      setStatus('Player preview retrieved. No persistent connection is open.')
    } catch(error) {
      setPlayerPage(null)
      setStatus(readableFailure(error))
    } finally {setBusy(false)}
  }

  const page = playerPage?.data
  return <div className="max-w-5xl space-y-6">
    <PageHeader title="Morkahja — Read-only dashboard"
      description="A separate, manually requested snapshot from the approved PostgreSQL role. No legacy moderation or session-cleanup code is used." />
    <p className="text-sm text-fog" role="status">{status}</p>
    <section className={border}>
      <label htmlFor="readonly-profile" className="block text-xs uppercase tracking-widest text-fog">
        Authorized Morkahja connection
      </label>
      <select id="readonly-profile" value={profileId} className="mt-2 w-full rounded border border-gold/25 bg-ash p-2 text-parchment"
        onChange={event => {
          setProfileId(event.target.value)
          setOverview(null)
          setPlayerPage(null)
        }}>
        <option value="">Choose SSH / PostgreSQL profile</option>
        {profiles.map(profile => <option key={profile.id} value={profile.id}>
          {profile.displayName + ' · ' + profile.target}
        </option>)}
      </select>
      <p className="mt-3 text-xs text-fog">
        Reads require separate operator approval of the exact three player fields:
        display name, avatar count and last-played time. Nothing loads automatically.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy || !profileId}
          onClick={() => {void loadOverview()}}>Load database overview</button>
        <button type="button" className={button} disabled={busy || !profileId}
          onClick={() => {void loadPlayers(1)}}>Load player preview</button>
      </div>
    </section>

    {overview && <section aria-label="Database overview" className="space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-gold-bright">Database overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Players" value={overview.data.players} />
        <StatCard label="Avatars" value={overview.data.avatars} />
        <StatCard label="Active sessions" value={overview.data.activeSessions}
          hint="Nonexpired sessions matching the player's active-session reference" />
        <StatCard label="Recent events" value={overview.data.eventsLast24h}
          hint="All game events in the last 24 hours" />
      </div>
      <p className="text-xs text-fog">Checked: {checkedTime(overview.checkedAt)} · SSH disconnected after snapshot.</p>
    </section>}

    {playerPage && page && <section className={border} aria-label="Read-only player preview">
      <h2 className="text-sm uppercase tracking-widest text-gold-bright">Player preview</h2>
      <p className="mt-2 text-xs text-fog">
        Approved fields only. No player IDs, public identity keys, session tokens or moderation controls.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-gold/20 text-fog">
            <tr><th className="py-2 pr-4">Display name</th>
              <th className="py-2 pr-4">Avatars</th>
              <th className="py-2">Last played</th></tr>
          </thead>
          <tbody>
            {page.players.map((player,index) => <tr key={index}
              className="border-b border-gold/10 text-parchment">
              <td className="py-2 pr-4">{player.displayName}</td>
              <td className="py-2 pr-4">{player.avatarCount}</td>
              <td className="py-2">{lastPlayed(player.lastPlayedAt)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {page.players.length === 0 && <p className="mt-3 text-sm text-fog">No players on this page.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fog">Page {page.page} · {page.total} players · {page.pageSize} per page</p>
        <div className="flex gap-2">
          <button type="button" className={button} disabled={busy || page.page <= 1}
            onClick={() => {void loadPlayers(page.page - 1)}}>Previous</button>
          <button type="button" className={button}
            disabled={busy || page.page >= 1000 || page.page * page.pageSize >= page.total}
            onClick={() => {void loadPlayers(page.page + 1)}}>Next</button>
        </div>
      </div>
      <p className="mt-3 text-xs text-fog">Checked: {checkedTime(playerPage.checkedAt)} · SSH disconnected after snapshot.</p>
    </section>}
  </div>
}
