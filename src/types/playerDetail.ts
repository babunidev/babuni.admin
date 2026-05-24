import type { Player } from './index'

export interface PlayerDetailAvatar {
  id: string
  name: string
  race?: string
  role?: string
  level: number
  experience: number
  portrait?: string
  frame?: string
  isActive: boolean
  lastPlayedAt?: string
  createdAt?: string
  lastEncounterId?: number
  editMode?: boolean
  progression: {
    level: number
    experience: number
    encountersCompleted: number
    encountersFailed: number
  }
  inventoryCounts: {
    spellbook: number
    items: number
    essences: number
  }
  activeEncounterTitle?: string
}

export interface PlayerAchievement {
  achievementId: string
  rank: number
  progress: number
  unlockedAt?: string
  updatedAt: string
}

export interface PlayerEncounterEvent {
  id: string
  timestamp: string
  type: string
  title?: string
  avatarId?: string
  outcome?: string
  importance: string
}

export interface PlayerDetail {
  summary: Player
  playerId: string
  identityPublicKey?: string
  createdAt: string
  lastPlayedAt: string
  unlockedExpansions: number[]
  friendIds: string[]
  currencies: Record<string, number>
  loreGemClaims: Record<string, boolean>
  dailyReward?: {
    utcDay: string
    encountersPlayed: number
    claimedAt?: string
  }
  avatars: PlayerDetailAvatar[]
  achievements: PlayerAchievement[]
  recentEncounters: PlayerEncounterEvent[]
}
