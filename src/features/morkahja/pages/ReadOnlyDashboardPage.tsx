import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../../../shared/components/PageHeader'
import { StatCard } from '../components/StatCard'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'
import { MODERATION_PROFILE_KEY } from '../services/adminApi'

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
  achievementsUnlocked?: number | null
  playersWithAchievements?: number | null
  diceUnlocks?: number | null
  expansionUnlocks?: number | null
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
interface Snapshot {
  overview: Overview
  playerPage: PlayerPage
}

const metricValue = (value: number | null | undefined): number | string =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 'Unavailable'

const LEGACY_PROFILE_KEY = 'babuni-admin:morkahja:overview-profile'
const PROFILE_KEY = MODERATION_PROFILE_KEY
const border = 'rounded-lg border border-gold/20 bg-slate/50 p-4'
const button = 'rounded border border-gold/40 px-3 py-2 text-sm text-gold-bright disabled:opacity-40'
const checkedTime = (value: string) => new Date(value).toLocaleString()
const lastPlayed = (value: number | null) =>
  value === null ? 'Not recorded' : new Date(value).toLocaleString()

// Only a non-secret profile UUID is persisted on the local PC. No password,
// identity key, player data, or session capability is stored in the browser.
function savedProfile():string {
  try { return window.localStorage.getItem(PROFILE_KEY) || window.localStorage.getItem(LEGACY_PROFILE_KEY) || '' } catch { return '' }
}
function persistProfile(id:string) {
  try {
    if(id) window.localStorage.setItem(PROFILE_KEY,id)
    else window.localStorage.removeItem(PROFILE_KEY)
  } catch { /* Private browsing may disable storage; manual selection still works. */ }
}
const readErrorHints: Record<string,string> = {
  DB_READ_PERMISSION_DENIED: 'The restricted PostgreSQL views are not accessible to this reader.',
  DB_ROLE_RAW_READ_ACCESS: 'The reader has unexpected access to sensitive raw tables.',
  DB_READ_TABLE_MISSING: 'A required restricted view is missing.',
  DB_READ_COLUMN_MISSING: 'The database view columns do not match the approved contract.',
  DB_READ_SCHEMA_MISMATCH: 'The restricted view schema is not compatible with this dashboard.',
  DB_READ_INVALID_DATA: 'The fixed query encountered an unsupported database value.',
  DB_READ_TIMEOUT: 'The read-only query exceeded its time limit.',
  DB_READ_AUTH_FAILED: 'PostgreSQL did not accept the configured database login.',
  DB_READ_CONNECTION_FAILED: 'The temporary database connection was interrupted.',
  SSH_SESSION_FAILED: 'SSH stopped before opening its temporary database tunnel. The exact cause was not recognized.',
  SSH_HOST_KEY_REJECTED: 'SSH refused the server host key. Check the pinned key offline before retrying; do not disable strict verification.',
  SSH_IDENTITY_UNAVAILABLE: 'The approved SSH identity could not be loaded or used. Check the configured key path and permissions.',
  SSH_AUTH_REJECTED: 'The SSH server rejected authentication using the approved identity.',
  SSH_FORWARD_DENIED: 'SSH could not establish the required temporary database forward.',
  SSH_CLIENT_CONFIG_INVALID: 'The installed OpenSSH client rejected a configured option.',
  SSH_HOST_UNREACHABLE: 'SSH could not reach or maintain a connection to the configured server.',
  SSH_FORWARD_TIMEOUT: 'SSH did not open the temporary database forward within the expected time.',
  REMOTE_PROBE_BUSY: 'A previous SSH check is still running. Refresh after it closes.',
}
function readableFailure(error:unknown):string {
  const code=error instanceof Error ? error.message : 'REMOTE_READ_FAILED'
  return readErrorHints[code] ? code + ' — ' + readErrorHints[code] : code
}

export function ReadOnlyDashboardPage() {
  const [profiles, setProfiles] = useState<ConnectionOption[]>([])
  const [profileId, setProfileId] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [overview, setOverview] = useState<ReadResponse<Overview> | null>(null)
  const [playerPage, setPlayerPage] = useState<ReadResponse<PlayerPage> | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Looking up authorized local connection profiles…')
  const [refreshNumber, setRefreshNumber] = useState(0)
  const currentPage = useRef(1)

  useEffect(() => {
    let mounted = true
    void localConnectionApi<{profiles: ConnectionOption[]}>().then(result => {
      if (!mounted) return
      const eligible = result.profiles.filter(profile =>
        profile.projectId === 'morkahja' && ['postgres-ssh-moderation','postgres-ssh'].includes(profile.kind))
      eligible.sort((a,b) => Number(b.kind==='postgres-ssh-moderation') - Number(a.kind==='postgres-ssh-moderation'))
      setProfiles(eligible)
      const remembered = savedProfile()
      const found = eligible.some(profile => profile.id === remembered)
      if (remembered && !found) persistProfile('')
      setProfileId(found ? remembered : eligible.find(profile=>profile.kind==='postgres-ssh-moderation')?.id || '')
      setProfileReady(true)
      setStatus(found ? 'Restoring your selected Morkahja Overview…'
        : eligible.length > 0
          ? 'Select a saved SSH profile below to load the overview and players.'
          : 'No Morkahja PostgreSQL/SSH profile is configured.')
    }).catch(error => {
      if (!mounted) return
      setProfileReady(true)
      setStatus(readableFailure(error))
    })
    return () => { mounted = false }
  }, [])

  // A previously selected profile reloads its snapshot when this page opens.
  // The server still repeats every private opt-in, role and SSH verification.
  // There is no polling, persistent connection or background database access.
  useEffect(() => {
    if (!profileReady || !profileId) return
    let cancelled = false
    const page = currentPage.current
    const load = async () => {
      setBusy(true)
      setStatus('Refreshing approved overview and player preview…')
      try {
        const result = await localConnectionApi<ReadResponse<Snapshot>>(
          'POST', '/' + profileId + '/read-dashboard', {page})
        if (cancelled) return
        setOverview({ok:true,checkedAt:result.checkedAt,data:result.data.overview})
        setPlayerPage({ok:true,checkedAt:result.checkedAt,data:result.data.playerPage})
        setStatus('Overview and players refreshed. SSH disconnected after snapshot.')
      } catch(error) {
        if (!cancelled) setStatus(readableFailure(error) +
          (overview ? ' · Previously loaded figures may be out of date.' : ''))
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void load()
    return () => { cancelled = true }
    // Only a profile selection or explicit Refresh starts this combined read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId,profileReady,refreshNumber])

  function chooseProfile(id:string) {
    if (busy) return
    persistProfile(id)
    currentPage.current=1
    setOverview(null)
    setPlayerPage(null)
    setProfileId(id)
    if (!id) setStatus('Select an authorized SSH profile below.')
  }

  function refresh() {
    if (!profileId || busy) return
    setRefreshNumber(value => value + 1)
  }

  async function loadPlayers(page:number) {
    if (!profileId || busy || page < 1 || page > 1000) return
    setBusy(true)
    setStatus('Refreshing player preview…')
    try {
      const result = await localConnectionApi<ReadResponse<PlayerPage>>(
        'POST', '/' + profileId + '/read-players', {page})
      currentPage.current=page
      setPlayerPage(result)
      setStatus('Player preview refreshed. SSH disconnected after snapshot.')
    } catch(error) {
      setStatus(readableFailure(error) +
        (playerPage ? ' · Previously loaded players may be out of date.' : ''))
    } finally { setBusy(false) }
  }

  const page = playerPage?.data
  return <div className="max-w-5xl space-y-6">
    <PageHeader title="Morkahja — Overview"
      description="Realm overview and player activity from the existing PostgreSQL views; supports the single administrator profile." />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-fog" role="status">{status}</p>
      <button type="button" className={button} disabled={busy || !profileId}
        onClick={refresh}>Refresh overview and players</button>
    </div>

    <section aria-label="Database overview" className="space-y-3">
      <h2 className="text-sm uppercase tracking-widest text-gold-bright">Database overview</h2>
      {overview ? <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Players" value={overview.data.players} />
          <StatCard label="Avatars" value={overview.data.avatars} />
          <StatCard label="Players online*" value={overview.data.activeSessions}
            hint="Session-based estimate, not a live presence heartbeat" />
          <StatCard label="Active sessions" value={overview.data.activeSessions}
            hint="Nonexpired, matching a player's current session" />
          <StatCard label="Recent events" value={overview.data.eventsLast24h}
            hint="Game events in the previous 24 hours" />
        </div>
        <div aria-label="Achievements and ownership" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Achievements unlocked" value={metricValue(overview.data.achievementsUnlocked)}
            hint="Earned player-achievement records, not summed ranks" />
          <StatCard label="Players with achievements" value={metricValue(overview.data.playersWithAchievements)} />
          <StatCard label="Dice unlocks" value={metricValue(overview.data.diceUnlocks)}
            hint="Non-default ownership across players; not purchases" />
          <StatCard label="Expansion unlocks" value={metricValue(overview.data.expansionUnlocks)}
            hint="Non-default ownership, including inactive expansions; not purchases" />
        </div>
        <p className="text-xs text-fog">Unavailable means the metric is not enabled or a valid aggregate could not be read.</p>
        <p className="text-xs text-fog">Checked: {checkedTime(overview.checkedAt)} · SSH disconnected after snapshot.</p>
      </> : <p className="text-sm text-fog">Choose your authorized connection in the section below to load the figures.</p>}
    </section>

    <section className={border} aria-label="Read-only player preview">
      <h2 className="text-sm uppercase tracking-widest text-gold-bright">Player preview</h2>
      <p className="mt-2 text-xs text-fog">
        Approved fields only: display name, avatar count and last played.
        No player IDs, identity keys or session tokens.
      </p>
      {playerPage && page ? <>
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
      </> : <p className="mt-4 text-sm text-fog">Player preview loads with the database overview.</p>}
    </section>

    <section className={border} aria-label="Read-only connection settings">
      <h2 className="text-sm uppercase tracking-widest text-gold-bright">Connection settings</h2>
      <label htmlFor="readonly-profile" className="mt-3 block text-xs uppercase tracking-widest text-fog">
        Authorized Morkahja connection
      </label>
      <select id="readonly-profile" value={profileId} disabled={busy}
        className="mt-2 w-full rounded border border-gold/25 bg-ash p-2 text-parchment disabled:opacity-60"
        onChange={event => chooseProfile(event.target.value)}>
        <option value="">Choose SSH / PostgreSQL profile</option>
        {profiles.map(profile => <option key={profile.id} value={profile.id}>
          {profile.displayName + ' · ' + profile.target}
        </option>)}
      </select>
      <p className="mt-3 text-xs text-fog">
        Selecting a profile loads both panels and remembers only its local profile ID on this PC.
        Reloading this page refreshes the authorized snapshot. No credentials or player data are saved
        to browser storage, and the SSH tunnel closes after every request.
      </p>
    </section>
  </div>
}
