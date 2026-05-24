export type PlayerStatus = 'online' | 'offline' | 'banned' | 'timed_out'

export interface Player {
  id: string
  name: string
  status: PlayerStatus
  level: number
  realm: string
  lastSeen: string
  isOnline: boolean
  activeAvatar?: string
  /** ISO timestamp when timeout ends; null if not timed out */
  timeoutUntil?: string | null
  banReason?: string
  avatarCount?: number
  createdAt?: string
}

export type ActivityImportance = 'low' | 'normal' | 'high'

export interface ActivityFeedItem {
  id: string
  timestamp: string
  playerName: string
  message: string
  importance: ActivityImportance
  category: 'encounter' | 'moderation' | 'social' | 'system'
}

export interface DashboardStats {
  onlinePlayers: number
  timedOutPlayers: number
  bannedPlayers: number
  eventsToday: number
  serverUptime: string
}

export interface ServerStatus {
  label: string
  state: 'online' | 'degraded' | 'offline'
  version: string
  region: string
}

export interface TimeoutPlayerRequest {
  playerId: string
  durationMinutes: number
  reason?: string
}

export interface BanPlayerRequest {
  playerId: string
  reason?: string
}

export interface ModerationResult {
  ok: boolean
  playerId: string
  message: string
}

export type {
  PlayerAchievement,
  PlayerDetail,
  PlayerDetailAvatar,
  PlayerEncounterEvent,
} from './playerDetail'
