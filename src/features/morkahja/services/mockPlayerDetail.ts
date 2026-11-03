import type { PlayerDetail } from '../types/playerDetail'
import { getMockPlayers } from './mockState'

export function getMockPlayerDetail(playerId: string): PlayerDetail | null {
  const summary = getMockPlayers().find((player) => player.id === playerId)
  if (!summary) return null

  const now = Date.now()
  return {
    summary,
    playerId,
    identityPublicKey: 'mock-public-key',
    createdAt: summary.createdAt ?? new Date(now - 30 * 86_400_000).toISOString(),
    lastPlayedAt: summary.lastSeen,
    unlockedExpansions: [1, 2, 5],
    friendIds: ['p-002', 'p-006'],
    currencies: { yellow_red_gem: 12 },
    loreGemClaims: { 'enc-00123': true },
    dailyReward: {
      utcDay: new Date().toISOString().slice(0, 10),
      encountersPlayed: 3,
    },
    avatars: [
      {
        id: `${playerId}-avatar-1`,
        name: summary.activeAvatar ?? 'Main',
        race: 'Rokur',
        role: 'Warrior',
        level: summary.level,
        experience: summary.level * 120,
        portrait: 'dur_portrait',
        frame: 'frame_gold',
        isActive: true,
        lastPlayedAt: summary.lastSeen,
        createdAt: summary.createdAt,
        lastEncounterId: 42,
        progression: {
          level: summary.level,
          experience: summary.level * 120,
          encountersCompleted: 87,
          encountersFailed: 4,
        },
        inventoryCounts: { spellbook: 6, items: 3, essences: 2 },
        activeEncounterTitle: 'Nerevals Sanctuary',
      },
      {
        id: `${playerId}-avatar-2`,
        name: 'Alt',
        race: 'Verdani',
        role: 'Mage',
        level: 12,
        experience: 340,
        isActive: false,
        lastPlayedAt: new Date(now - 5 * 86_400_000).toISOString(),
        progression: {
          level: 12,
          experience: 340,
          encountersCompleted: 22,
          encountersFailed: 1,
        },
        inventoryCounts: { spellbook: 5, items: 1, essences: 0 },
      },
    ],
    achievements: [
      {
        achievementId: 'adventurer',
        rank: 2,
        progress: 45,
        unlockedAt: new Date(now - 10 * 86_400_000).toISOString(),
        updatedAt: new Date(now - 1 * 86_400_000).toISOString(),
      },
      {
        achievementId: 'alpha_player',
        rank: 1,
        progress: 1,
        unlockedAt: new Date(now - 60 * 86_400_000).toISOString(),
        updatedAt: new Date(now - 60 * 86_400_000).toISOString(),
      },
      {
        achievementId: 'combatant_encounter_42',
        rank: 1,
        progress: 1,
        updatedAt: new Date(now - 2 * 86_400_000).toISOString(),
      },
    ],
    recentEncounters: [
      {
        id: 'evt-1',
        timestamp: new Date(now - 3_600_000).toISOString(),
        type: 'encounter_completed',
        title: 'Nerevals Sanctuary',
        avatarId: `${playerId}-avatar-1`,
        outcome: 'Prosperity',
        importance: 'normal',
      },
      {
        id: 'evt-2',
        timestamp: new Date(now - 7_200_000).toISOString(),
        type: 'encounter_roll',
        title: 'Hearthguard Sanctuary',
        avatarId: `${playerId}-avatar-1`,
        outcome: 'Misery',
        importance: 'low',
      },
    ],
  }
}
