import { localAdminApiBase, useLocalPostgres } from '../config/constants'
import { apiBaseUrl, useMockData } from '../config/api'
import type {
  ActivityFeedItem,
  BanPlayerRequest,
  DashboardStats,
  ModerationResult,
  Player,
  ServerStatus,
  TimeoutPlayerRequest,
} from '../types'
import type { PlayerDetail } from '../types/playerDetail'
import { getMockPlayerDetail } from './mockPlayerDetail'
import { apiGet, apiPost } from './http'
import {
  getMockActivityFeed,
  getMockDashboardStats,
  getMockOnlinePlayers,
  getMockPlayers,
  mockBanPlayer,
  mockServerStatus,
  mockTimeoutPlayer,
  mockUnbanPlayer,
} from './mockState'

async function localGet<T>(path: string): Promise<T> {
  const response = await fetch(`${localAdminApiBase}${path}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `PostgreSQL API failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

async function localPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${localAdminApiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `PostgreSQL API failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

async function fromPlayersSource<T>(
  path: string,
  mock: T | (() => T),
): Promise<T> {
  if (useLocalPostgres) {
    return localGet<T>(path)
  }
  if (useMockData) {
    return typeof mock === 'function' ? (mock as () => T)() : mock
  }
  return apiGet<T>(path)
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  if (useLocalPostgres) {
    return localGet('/server')
  }
  if (useMockData) {
    return mockServerStatus
  }
  return apiGet('/server')
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return fromPlayersSource('/dashboard', getMockDashboardStats)
}

function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT') ||
    message.includes('password authentication failed') ||
    message.includes('LOCAL_ADMIN_ERROR') ||
    message.includes('PostgreSQL API failed')
  )
}

export type PlayersQueryResult = {
  players: Player[]
  isSample: boolean
  dbError?: string
}

export async function fetchPlayersWithMeta(): Promise<PlayersQueryResult> {
  if (useLocalPostgres) {
    try {
      const players = await localGet<Player[]>('/players')
      return { players, isSample: false }
    } catch (error) {
      const dbError = error instanceof Error ? error.message : String(error)

      if (!useMockData && apiBaseUrl.length > 0) {
        try {
          const players = await apiGet<Player[]>('/players')
          return { players, isSample: false }
        } catch {
          // try mock below
        }
      }

      if (import.meta.env.DEV) {
        return { players: getMockPlayers(), isSample: true, dbError }
      }

      throw error
    }
  }

  if (useMockData) {
    return { players: getMockPlayers(), isSample: true }
  }

  const players = await apiGet<Player[]>('/players')
  return { players, isSample: false }
}

export async function fetchPlayers(): Promise<Player[]> {
  const result = await fetchPlayersWithMeta()
  return result.players
}

export async function fetchPlayerDetail(playerId: string): Promise<PlayerDetail> {
  if (useLocalPostgres) {
    try {
      return await localGet<PlayerDetail>(`/players/${encodeURIComponent(playerId)}`)
    } catch (error) {
      if (import.meta.env.DEV) {
        const mock = getMockPlayerDetail(playerId)
        if (mock) return mock
      }
      throw error
    }
  }

  if (useMockData) {
    const mock = getMockPlayerDetail(playerId)
    if (!mock) throw new Error('PLAYER_NOT_FOUND')
    return mock
  }

  return apiGet<PlayerDetail>(`/players/${encodeURIComponent(playerId)}`)
}

export function formatPlayersLoadError(error: unknown): {
  title: string
  message: string
  hint?: string
} {
  const raw = error instanceof Error ? error.message : String(error)

  if (raw.includes('ECONNREFUSED') && raw.includes('5433')) {
    return {
      title: 'Cannot reach PostgreSQL on port 5433',
      message:
        'The admin tool is configured for a local SSH tunnel, but nothing is listening on 127.0.0.1:5433.',
      hint: 'ssh -L 5433:127.0.0.1:5432 morkahja@89.167.120.88',
    }
  }

  if (isConnectionError(error)) {
    return {
      title: 'Database connection failed',
      message: raw,
      hint: 'Check VITE_DATABASE_URL in .env.local and keep the SSH tunnel open while npm run dev runs.',
    }
  }

  return {
    title: 'Failed to load players',
    message: raw,
  }
}

export async function fetchOnlinePlayers(): Promise<Player[]> {
  return fromPlayersSource('/players/online', getMockOnlinePlayers)
}

export async function fetchActivityFeed(): Promise<ActivityFeedItem[]> {
  if (useLocalPostgres) {
    return localGet('/activity')
  }
  if (useMockData) {
    return getMockActivityFeed()
  }
  return apiGet('/activity')
}

export async function timeoutPlayer(
  request: TimeoutPlayerRequest,
): Promise<ModerationResult> {
  if (useLocalPostgres) {
    return localPost('/players/timeout', request)
  }
  if (useMockData) {
    const player = mockTimeoutPlayer(
      request.playerId,
      request.durationMinutes,
      request.reason,
    )
    return {
      ok: Boolean(player),
      playerId: request.playerId,
      message: player
        ? `${player.name} timed out for ${request.durationMinutes}m`
        : 'Player not found',
    }
  }
  return apiPost('/players/timeout', request)
}

export async function banPlayer(request: BanPlayerRequest): Promise<ModerationResult> {
  if (useLocalPostgres) {
    return localPost('/players/ban', request)
  }
  if (useMockData) {
    const player = mockBanPlayer(request.playerId, request.reason)
    return {
      ok: Boolean(player),
      playerId: request.playerId,
      message: player ? `${player.name} banned` : 'Player not found',
    }
  }
  return apiPost('/players/ban', request)
}

export async function unbanPlayer(playerId: string): Promise<ModerationResult> {
  if (useLocalPostgres) {
    return localPost('/players/unban', { playerId })
  }
  if (useMockData) {
    const player = mockUnbanPlayer(playerId)
    return {
      ok: Boolean(player),
      playerId,
      message: player ? `${player.name} unbanned` : 'Player not found',
    }
  }
  return apiPost('/players/unban', { playerId })
}

export async function pingPlayersApi(): Promise<boolean> {
  if (useLocalPostgres) {
    try {
      await localGet('/dashboard')
      return true
    } catch {
      return false
    }
  }
  try {
    await apiGet('/server')
    return true
  } catch {
    return false
  }
}
