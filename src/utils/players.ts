import type { Player } from '../types'

const statusOrder: Record<Player['status'], number> = {
  online: 0,
  offline: 1,
  timed_out: 2,
  banned: 3,
}

/** Online first, then by status, then most recently seen. */
export function sortPlayersForList(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1
    }
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  })
}

export function countOnlinePlayers(players: Player[]): number {
  return players.filter((player) => player.isOnline).length
}
