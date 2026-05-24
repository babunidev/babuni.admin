import pg from 'pg'

import type {
  ActivityFeedItem,
  DashboardStats,
  Player,
  ServerStatus,
} from '../src/types'
import type {
  PlayerAchievement,
  PlayerDetail,
  PlayerDetailAvatar,
  PlayerEncounterEvent,
} from '../src/types/playerDetail'

const { Pool } = pg

let pool: pg.Pool | null = null

interface PlayerRow {
  id: string
  data: PlayerDocumentJson
}

interface PlayerDocumentJson {
  playerId?: string
  playerName?: string
  identityPublicKey?: string
  activeSessionId?: string | null
  activeSessionExpiresAt?: number | null
  createdAt?: number
  lastPlayedAt?: number
  activeAvatarId?: string
  unlockedExpansions?: number[]
  friendIds?: string[]
  currencies?: Record<string, number>
  loreGemClaims?: Record<string, boolean>
  dailyReward?: {
    utcDay: string
    encountersPlayed: number
    claimedAt?: number
  }
  moderation?: {
    banned?: boolean
    banReason?: string
    timeoutUntil?: number | null
  }
}

interface AvatarRow {
  id?: string
  name?: string
  level?: number
  experience?: number
  race?: string
  role?: string
  portrait?: string
  frame?: string
  createdAt?: number
  lastPlayedAt?: number
  editMode?: boolean
  progression?: { lastEncounterId?: number }
}

interface ProgressionRow {
  level?: number
  experience?: number
  encountersCompleted?: number
  encountersFailed?: number
}

interface InventoryRow {
  spellbook?: Array<unknown>
  items?: Array<unknown>
  essences?: Array<unknown>
}

interface EncounterRow {
  title?: string
  encounterTitle?: string
  encounterId?: number
}

function getPool(connectionString: string): pg.Pool {
  pool ??= new Pool({ connectionString })
  return pool
}

function isTimedOut(player: PlayerDocumentJson, now: number): boolean {
  const until = player.moderation?.timeoutUntil
  return typeof until === 'number' && until > now
}

function isBanned(player: PlayerDocumentJson): boolean {
  return player.moderation?.banned === true
}

function isOnline(
  player: PlayerDocumentJson,
  now: number,
  liveSessionPlayerIds: Set<string>,
  playerId: string,
): boolean {
  if (!liveSessionPlayerIds.has(playerId)) return false
  return !isBanned(player) && !isTimedOut(player, now)
}

function resolveStatus(
  player: PlayerDocumentJson,
  now: number,
  liveSessionPlayerIds: Set<string>,
  playerId: string,
): Player['status'] {
  if (isBanned(player)) return 'banned'
  if (isTimedOut(player, now)) return 'timed_out'
  if (isOnline(player, now, liveSessionPlayerIds, playerId)) return 'online'
  return 'offline'
}

async function purgeExpiredSessions(db: pg.Pool, now: number): Promise<void> {
  await db.query(
    `DELETE FROM sessions
     WHERE COALESCE((data->>'expiresAt')::bigint, 0) <= $1`,
    [now],
  )
}

/** Online only when activeSessionId matches a non-expired session (not orphan rows). */
async function listLiveSessionPlayerIds(
  db: pg.Pool,
  now: number,
): Promise<Set<string>> {
  await purgeExpiredSessions(db, now)

  const result = await db.query<{ player_id: string }>(
    `SELECT DISTINCT p.id AS player_id
     FROM players p
     INNER JOIN sessions s
       ON s.player_id = p.id
       AND s.id = COALESCE(p.data->>'activeSessionId', '')
     WHERE COALESCE((s.data->>'expiresAt')::bigint, 0) > $1
       AND COALESCE(p.data->>'activeSessionId', '') <> ''`,
    [now],
  )
  return new Set(result.rows.map((row) => row.player_id))
}

async function revokeAllPlayerSessions(
  db: pg.Pool,
  playerId: string,
): Promise<void> {
  await db.query('DELETE FROM sessions WHERE player_id = $1', [playerId])
}

function mapPlayer(
  row: PlayerRow,
  activeAvatar: AvatarRow | undefined,
  avatarCount: number,
  liveSessionPlayerIds: Set<string>,
): Player {
  const now = Date.now()
  const data = row.data
  const status = resolveStatus(data, now, liveSessionPlayerIds, row.id)
  const race = activeAvatar?.race ?? 'Unknown'
  const role = activeAvatar?.role ?? 'Unknown'

  return {
    id: row.id,
    name: data.playerName ?? row.id,
    status,
    level: typeof activeAvatar?.level === 'number' ? activeAvatar.level : 1,
    realm: `${race} · ${role}`,
    lastSeen: new Date(data.lastPlayedAt ?? data.createdAt ?? now).toISOString(),
    isOnline: status === 'online',
    activeAvatar: activeAvatar?.name,
    timeoutUntil:
      typeof data.moderation?.timeoutUntil === 'number'
        ? new Date(data.moderation.timeoutUntil).toISOString()
        : null,
    banReason: data.moderation?.banReason,
    avatarCount,
    createdAt: new Date(data.createdAt ?? now).toISOString(),
  }
}

export async function listPlayersFromPostgres(
  connectionString: string,
): Promise<Player[]> {
  const db = getPool(connectionString)
  const now = Date.now()
  const playersResult = await db.query<PlayerRow>(
    `SELECT id, data FROM players
     ORDER BY (data->>'lastPlayedAt')::bigint DESC NULLS LAST`,
  )

  const playerIds = playersResult.rows.map((row) => row.id)
  if (playerIds.length === 0) return []

  const [avatarsResult, countsResult, liveSessionPlayerIds] = await Promise.all([
    db.query<{ player_id: string; data: AvatarRow }>(
      `SELECT a.player_id, a.data
       FROM avatars a
       INNER JOIN players p ON p.id = a.player_id
         AND COALESCE(p.data->>'activeAvatarId', '') = a.id
       WHERE a.player_id = ANY($1::text[])`,
      [playerIds],
    ),
    db.query<{ player_id: string; count: string }>(
      `SELECT player_id, COUNT(*)::int AS count
       FROM avatars WHERE player_id = ANY($1::text[])
       GROUP BY player_id`,
      [playerIds],
    ),
    listLiveSessionPlayerIds(db, now),
  ])

  const activeByPlayer = new Map(
    avatarsResult.rows.map((row) => [row.player_id, row.data]),
  )
  const counts = new Map(
    countsResult.rows.map((row) => [row.player_id, Number(row.count)]),
  )

  const players = playersResult.rows.map((row) =>
    mapPlayer(
      row,
      activeByPlayer.get(row.id),
      counts.get(row.id) ?? 0,
      liveSessionPlayerIds,
    ),
  )

  players.sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
    const rank: Record<Player['status'], number> = {
      online: 0,
      offline: 1,
      timed_out: 2,
      banned: 3,
    }
    const d = rank[a.status] - rank[b.status]
    if (d !== 0) return d
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  })

  return players
}

export async function listOnlinePlayersFromPostgres(
  connectionString: string,
): Promise<Player[]> {
  const players = await listPlayersFromPostgres(connectionString)
  return players.filter((player) => player.isOnline)
}

export async function getDashboardFromPostgres(
  connectionString: string,
): Promise<DashboardStats> {
  const players = await listPlayersFromPostgres(connectionString)
  const db = getPool(connectionString)
  const since = Date.now() - 24 * 60 * 60 * 1000
  const events = await db.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM game_events WHERE timestamp >= $1`,
    [since],
  )

  return {
    onlinePlayers: players.filter((player) => player.isOnline).length,
    timedOutPlayers: players.filter((player) => player.status === 'timed_out').length,
    bannedPlayers: players.filter((player) => player.status === 'banned').length,
    eventsToday: Number(events.rows[0]?.count ?? 0),
    serverUptime: 'PostgreSQL',
  }
}

export async function listActivityFromPostgres(
  connectionString: string,
): Promise<ActivityFeedItem[]> {
  const db = getPool(connectionString)
  const since = Date.now() - 60 * 60 * 1000
  const result = await db.query<{
    event_id: string
    timestamp: string
    player_id: string
    type: string
    importance: string
    payload: Record<string, unknown>
  }>(
    `SELECT event_id, timestamp, player_id, type, importance, payload
     FROM game_events
     WHERE timestamp >= $1 AND visibility = 'global'
     ORDER BY timestamp DESC
     LIMIT 50`,
    [since],
  )

  return result.rows.map((row) => ({
    id: row.event_id,
    timestamp: new Date(Number(row.timestamp)).toISOString(),
    playerName:
      typeof row.payload.playerName === 'string'
        ? row.payload.playerName
        : row.player_id,
    message: `${row.type}${row.payload.encounterTitle ? `: ${row.payload.encounterTitle}` : ''}`,
    importance:
      row.importance === 'high' || row.importance === 'legendary'
        ? 'high'
        : row.importance === 'low'
          ? 'low'
          : 'normal',
    category: row.type.includes('encounter')
      ? 'encounter'
      : row.type.includes('friend')
        ? 'social'
        : 'system',
  }))
}

async function loadPlayerRow(
  db: pg.Pool,
  playerId: string,
): Promise<PlayerRow | null> {
  const result = await db.query<PlayerRow>(
    'SELECT id, data FROM players WHERE id = $1',
    [playerId],
  )
  return result.rows[0] ?? null
}

async function savePlayerRow(db: pg.Pool, row: PlayerRow): Promise<void> {
  await db.query(
    `UPDATE players SET data = $2::jsonb WHERE id = $1`,
    [row.id, JSON.stringify(row.data)],
  )
}

export async function timeoutPlayerInPostgres(
  connectionString: string,
  playerId: string,
  durationMinutes: number,
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const db = getPool(connectionString)
  const row = await loadPlayerRow(db, playerId)
  if (!row) return { ok: false, message: 'Player not found' }

  row.data.activeSessionId = null
  row.data.activeSessionExpiresAt = null
  row.data.moderation = {
    ...row.data.moderation,
    banned: false,
    timeoutUntil: Date.now() + durationMinutes * 60_000,
    banReason: reason?.trim() || row.data.moderation?.banReason,
  }
  await savePlayerRow(db, row)
  await revokeAllPlayerSessions(db, playerId)

  return {
    ok: true,
    message: `${row.data.playerName ?? playerId} timed out for ${durationMinutes}m`,
  }
}

export async function banPlayerInPostgres(
  connectionString: string,
  playerId: string,
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const db = getPool(connectionString)
  const row = await loadPlayerRow(db, playerId)
  if (!row) return { ok: false, message: 'Player not found' }

  row.data.activeSessionId = null
  row.data.activeSessionExpiresAt = null
  row.data.moderation = {
    ...row.data.moderation,
    banned: true,
    banReason: reason?.trim() || 'Banned by admin',
    timeoutUntil: null,
  }
  await savePlayerRow(db, row)
  await revokeAllPlayerSessions(db, playerId)

  return { ok: true, message: `${row.data.playerName ?? playerId} banned` }
}

export async function unbanPlayerInPostgres(
  connectionString: string,
  playerId: string,
): Promise<{ ok: boolean; message: string }> {
  const db = getPool(connectionString)
  const row = await loadPlayerRow(db, playerId)
  if (!row) return { ok: false, message: 'Player not found' }

  row.data.moderation = {
    ...row.data.moderation,
    banned: false,
    banReason: undefined,
  }
  await savePlayerRow(db, row)
  return { ok: true, message: `${row.data.playerName ?? playerId} unbanned` }
}

export function getPostgresServerStatus(): ServerStatus {
  return {
    label: 'Morkahja PostgreSQL',
    state: 'online',
    version: 'local',
    region: 'Database',
  }
}

export async function pingPostgres(connectionString: string): Promise<boolean> {
  try {
    const db = getPool(connectionString)
    await db.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

function countInventorySlots(inventory?: InventoryRow): {
  spellbook: number
  items: number
  essences: number
} {
  return {
    spellbook: inventory?.spellbook?.length ?? 0,
    items: inventory?.items?.length ?? 0,
    essences: inventory?.essences?.length ?? 0,
  }
}

export async function getPlayerDetailFromPostgres(
  connectionString: string,
  playerId: string,
): Promise<PlayerDetail | null> {
  const db = getPool(connectionString)
  const playerResult = await db.query<PlayerRow>(
    'SELECT id, data FROM players WHERE id = $1',
    [playerId],
  )
  const playerRow = playerResult.rows[0]
  if (!playerRow) return null

  const data = playerRow.data
  const activeAvatarId = data.activeAvatarId ?? ''
  const now = Date.now()
  const liveSessionPlayerIds = await listLiveSessionPlayerIds(db, now)

  const [avatarsResult, achievementsResult, eventsResult] = await Promise.all([
    db.query<{ id: string; data: AvatarRow }>(
      'SELECT id, data FROM avatars WHERE player_id = $1 ORDER BY (data->>\'lastPlayedAt\')::bigint DESC NULLS LAST, id',
      [playerId],
    ),
    db
      .query<{
        achievement_id: string
        rank: number
        progress: number
        unlocked_at: string | null
        updated_at: string
      }>(
        `SELECT achievement_id, rank, progress, unlocked_at, updated_at
         FROM player_achievements
         WHERE player_id = $1
         ORDER BY updated_at DESC`,
        [playerId],
      )
      .catch(() => ({ rows: [] })),
    db.query<{
      event_id: string
      timestamp: string
      avatar_id: string | null
      type: string
      importance: string
      payload: Record<string, unknown>
    }>(
      `SELECT event_id, timestamp, avatar_id, type, importance, payload
       FROM game_events
       WHERE player_id = $1
       ORDER BY timestamp DESC
       LIMIT 80`,
      [playerId],
    ),
  ])

  const avatarIds = avatarsResult.rows.map((row) => row.id)
  const [progressionsResult, inventoriesResult, activeEncountersResult] =
    avatarIds.length === 0
      ? [{ rows: [] }, { rows: [] }, { rows: [] }]
      : await Promise.all([
          db.query<{ avatar_id: string; data: ProgressionRow }>(
            `SELECT avatar_id, data FROM progressions
             WHERE player_id = $1 AND avatar_id = ANY($2::text[]) AND id = 'current'`,
            [playerId, avatarIds],
          ),
          db.query<{ avatar_id: string; data: InventoryRow }>(
            `SELECT avatar_id, data FROM inventories
             WHERE player_id = $1 AND avatar_id = ANY($2::text[]) AND id = 'current'`,
            [playerId, avatarIds],
          ),
          db.query<{ avatar_id: string; data: EncounterRow }>(
            `SELECT avatar_id, data FROM active_encounters
             WHERE player_id = $1 AND avatar_id = ANY($2::text[]) AND id = 'current'`,
            [playerId, avatarIds],
          ),
        ])

  const progressionByAvatar = new Map(
    progressionsResult.rows.map((row) => [row.avatar_id, row.data]),
  )
  const inventoryByAvatar = new Map(
    inventoriesResult.rows.map((row) => [row.avatar_id, row.data]),
  )
  const encounterByAvatar = new Map(
    activeEncountersResult.rows.map((row) => [row.avatar_id, row.data]),
  )

  const avatars: PlayerDetailAvatar[] = avatarsResult.rows.map((row) => {
    const avatar = row.data
    const progression = progressionByAvatar.get(row.id)
    const inventory = inventoryByAvatar.get(row.id)
    const activeEncounter = encounterByAvatar.get(row.id)
    const encounterTitle =
      typeof activeEncounter?.encounterTitle === 'string'
        ? activeEncounter.encounterTitle
        : typeof activeEncounter?.title === 'string'
          ? activeEncounter.title
          : undefined

    return {
      id: row.id,
      name: avatar.name ?? row.id,
      race: avatar.race,
      role: avatar.role,
      level: progression?.level ?? avatar.level ?? 1,
      experience: progression?.experience ?? avatar.experience ?? 0,
      portrait: avatar.portrait,
      frame: avatar.frame,
      isActive: row.id === activeAvatarId,
      lastPlayedAt: avatar.lastPlayedAt
        ? new Date(avatar.lastPlayedAt).toISOString()
        : undefined,
      createdAt: avatar.createdAt
        ? new Date(avatar.createdAt).toISOString()
        : undefined,
      lastEncounterId: avatar.progression?.lastEncounterId,
      editMode: avatar.editMode,
      progression: {
        level: progression?.level ?? avatar.level ?? 1,
        experience: progression?.experience ?? avatar.experience ?? 0,
        encountersCompleted: progression?.encountersCompleted ?? 0,
        encountersFailed: progression?.encountersFailed ?? 0,
      },
      inventoryCounts: countInventorySlots(inventory),
      activeEncounterTitle: encounterTitle,
    }
  })

  const achievements: PlayerAchievement[] = achievementsResult.rows.map(
    (row) => ({
      achievementId: row.achievement_id,
      rank: Number(row.rank),
      progress: Number(row.progress),
      unlockedAt:
        row.unlocked_at === null
          ? undefined
          : new Date(Number(row.unlocked_at)).toISOString(),
      updatedAt: new Date(Number(row.updated_at)).toISOString(),
    }),
  )

  const recentEncounters: PlayerEncounterEvent[] = eventsResult.rows
    .filter(
      (row) =>
        row.type.includes('encounter') ||
        row.type.includes('roll') ||
        row.payload.encounterTitle ||
        row.payload.encounterId,
    )
    .map((row) => ({
      id: row.event_id,
      timestamp: new Date(Number(row.timestamp)).toISOString(),
      type: row.type,
      title:
        typeof row.payload.encounterTitle === 'string'
          ? row.payload.encounterTitle
          : typeof row.payload.title === 'string'
            ? row.payload.title
            : undefined,
      avatarId: row.avatar_id ?? undefined,
      outcome:
        typeof row.payload.outcome === 'string'
          ? row.payload.outcome
          : typeof row.payload.rollOutcome === 'string'
            ? row.payload.rollOutcome
            : undefined,
      importance: row.importance,
    }))

  const avatarCount = avatars.length
  const activeAvatar = avatars.find((avatar) => avatar.isActive)
  const summary = mapPlayer(
    playerRow,
    activeAvatar
      ? {
          name: activeAvatar.name,
          level: activeAvatar.level,
          race: activeAvatar.race,
          role: activeAvatar.role,
        }
      : undefined,
    avatarCount,
    liveSessionPlayerIds,
  )

  const currencies: Record<string, number> = {}
  if (data.currencies && typeof data.currencies === 'object') {
    for (const [key, value] of Object.entries(data.currencies)) {
      if (typeof value === 'number') currencies[key] = value
    }
  }

  return {
    summary,
    playerId: playerRow.id,
    identityPublicKey: data.identityPublicKey,
    createdAt: new Date(data.createdAt ?? Date.now()).toISOString(),
    lastPlayedAt: new Date(data.lastPlayedAt ?? data.createdAt ?? Date.now()).toISOString(),
    unlockedExpansions: Array.isArray(data.unlockedExpansions)
      ? data.unlockedExpansions
      : [],
    friendIds: Array.isArray(data.friendIds) ? data.friendIds : [],
    currencies,
    loreGemClaims: data.loreGemClaims ?? {},
    dailyReward: data.dailyReward
      ? {
          utcDay: data.dailyReward.utcDay,
          encountersPlayed: data.dailyReward.encountersPlayed,
          claimedAt:
            typeof data.dailyReward.claimedAt === 'number'
              ? new Date(data.dailyReward.claimedAt).toISOString()
              : undefined,
        }
      : undefined,
    avatars,
    achievements,
    recentEncounters,
  }
}
