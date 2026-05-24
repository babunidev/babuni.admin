import type {
  ActivityFeedItem,
  DashboardStats,
  Player,
  ServerStatus,
} from '../types'

const activityTemplates: Omit<ActivityFeedItem, 'id' | 'timestamp'>[] = [
  {
    playerName: 'Aelric_Thorn',
    message: 'Completed encounter: Nerevals Sanctuary',
    importance: 'normal',
    category: 'encounter',
  },
  {
    playerName: 'SableWisp',
    message: 'Unlocked expansion: Everwinter Valley',
    importance: 'high',
    category: 'system',
  },
  {
    playerName: 'VeyraNox',
    message: 'Added Grimhold as friend',
    importance: 'low',
    category: 'social',
  },
  {
    playerName: 'System',
    message: 'Storm surge triggered in Ashfen',
    importance: 'high',
    category: 'system',
  },
  {
    playerName: 'MiraVoid',
    message: 'Failed roll on Hearthguard Sanctuary',
    importance: 'normal',
    category: 'encounter',
  },
]

let activityTick = 0

const initialPlayers: Player[] = [
  {
    id: 'p-001',
    name: 'Aelric_Thorn',
    status: 'online',
    level: 42,
    realm: 'Ashfen',
    lastSeen: new Date().toISOString(),
    isOnline: true,
    activeAvatar: 'Dur',
  },
  {
    id: 'p-002',
    name: 'MiraVoid',
    status: 'online',
    level: 38,
    realm: 'Duskmire',
    lastSeen: new Date().toISOString(),
    isOnline: true,
    activeAvatar: 'Klatra',
  },
  {
    id: 'p-003',
    name: 'Grimhold',
    status: 'timed_out',
    level: 51,
    realm: 'Ashfen',
    lastSeen: new Date(Date.now() - 900_000).toISOString(),
    isOnline: false,
    activeAvatar: 'Stogro',
    timeoutUntil: new Date(Date.now() + 3_600_000).toISOString(),
  },
  {
    id: 'p-004',
    name: 'SableWisp',
    status: 'online',
    level: 29,
    realm: 'Ironhollow',
    lastSeen: new Date().toISOString(),
    isOnline: true,
    activeAvatar: 'Trabra',
  },
  {
    id: 'p-005',
    name: 'KaelDrift',
    status: 'banned',
    level: 19,
    realm: 'Duskmire',
    lastSeen: new Date(Date.now() - 86_400_000).toISOString(),
    isOnline: false,
    banReason: 'Exploit attempt',
  },
  {
    id: 'p-006',
    name: 'VeyraNox',
    status: 'online',
    level: 47,
    realm: 'Ironhollow',
    lastSeen: new Date().toISOString(),
    isOnline: true,
    activeAvatar: 'Dur',
  },
  {
    id: 'p-007',
    name: 'NyraShade',
    status: 'online',
    level: 33,
    realm: 'Ashfen',
    lastSeen: new Date().toISOString(),
    isOnline: true,
    activeAvatar: 'Klatra',
  },
]

let players = structuredClone(initialPlayers)

export const mockServerStatus: ServerStatus = {
  label: 'Morkahja Prime',
  state: 'online',
  version: '0.4.2',
  region: 'VPS',
}

function sortMockPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
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
}

export function getMockPlayers(): Player[] {
  const now = Date.now()
  const refreshed = players.map((player) => {
    if (
      player.status === 'timed_out' &&
      player.timeoutUntil &&
      new Date(player.timeoutUntil).getTime() <= now
    ) {
      return {
        ...player,
        status: 'online' as const,
        isOnline: true,
        timeoutUntil: null,
        lastSeen: new Date().toISOString(),
      }
    }
    return player
  })
  return sortMockPlayers(refreshed)
}

export function getMockOnlinePlayers(): Player[] {
  return getMockPlayers().filter((p) => p.isOnline && p.status === 'online')
}

export function getMockDashboardStats(): DashboardStats {
  const all = getMockPlayers()
  return {
    onlinePlayers: all.filter((p) => p.isOnline && p.status === 'online').length,
    timedOutPlayers: all.filter((p) => p.status === 'timed_out').length,
    bannedPlayers: all.filter((p) => p.status === 'banned').length,
    eventsToday: 342 + activityTick,
    serverUptime: '14d 6h',
  }
}

export function getMockActivityFeed(): ActivityFeedItem[] {
  activityTick += 1
  const now = Date.now()
  const items: ActivityFeedItem[] = []

  for (let i = 0; i < 12; i++) {
    const template =
      activityTemplates[(activityTick + i) % activityTemplates.length]
    items.push({
      id: `act-${activityTick}-${i}`,
      timestamp: new Date(now - i * 45_000 - (activityTick % 5) * 1_000).toISOString(),
      ...template,
      playerName:
        i === 0
          ? getMockOnlinePlayers()[activityTick % Math.max(1, getMockOnlinePlayers().length)]
              ?.name ?? template.playerName
          : template.playerName,
    })
  }

  return items
}

export function mockTimeoutPlayer(
  playerId: string,
  durationMinutes: number,
  reason?: string,
): Player | null {
  const index = players.findIndex((p) => p.id === playerId)
  if (index === -1) return null

  players[index] = {
    ...players[index],
    status: 'timed_out',
    isOnline: false,
    timeoutUntil: new Date(Date.now() + durationMinutes * 60_000).toISOString(),
    lastSeen: new Date().toISOString(),
  }

  if (reason) {
    players[index].banReason = reason
  }

  return getMockPlayers()[index]
}

export function mockBanPlayer(playerId: string, reason?: string): Player | null {
  const index = players.findIndex((p) => p.id === playerId)
  if (index === -1) return null

  players[index] = {
    ...players[index],
    status: 'banned',
    isOnline: false,
    timeoutUntil: null,
    banReason: reason ?? 'Banned by admin',
    lastSeen: new Date().toISOString(),
  }

  return getMockPlayers()[index]
}

export function mockUnbanPlayer(playerId: string): Player | null {
  const index = players.findIndex((p) => p.id === playerId)
  if (index === -1) return null

  players[index] = {
    ...players[index],
    status: 'offline',
    isOnline: false,
    timeoutUntil: null,
    banReason: undefined,
  }

  return getMockPlayers()[index]
}
