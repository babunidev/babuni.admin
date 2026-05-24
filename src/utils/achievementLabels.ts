const LABELS: Record<string, string> = {
  adventurer: 'Adventurer',
  alpha_player: 'Alpha Player',
  contributor: 'Contributor',
  blessed: 'Blessed',
}

export function formatAchievementId(id: string): string {
  if (LABELS[id]) return LABELS[id]
  if (id.startsWith('combatant_')) {
    return `Combatant (${id.replace('combatant_', '')})`
  }
  return id
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
