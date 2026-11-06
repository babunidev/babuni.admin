// Fixed aggregate contract; never supplied by browser requests.
export const PROGRESSION_FIELDS = Object.freeze([
  'achievementsUnlocked', 'playersWithAchievements', 'diceUnlocks', 'expansionUnlocks',
])

export function progressionApproved(config) {
  return config.readOnlyDataEnabled === true &&
    JSON.stringify(config.readOnlyMetricFields) === JSON.stringify(PROGRESSION_FIELDS)
}

export function unavailableProgression() {
  return Object.fromEntries(PROGRESSION_FIELDS.map(field => [field, null]))
}

function count(value) {
  if (typeof value !== 'number' &&
      !(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value))) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

export function normalizeProgression(rows) {
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]) return unavailableProgression()
  const row = rows[0]
  const valid = (...fields) => fields.every(field => count(row[field]) === 0)
  const achievements = count(row.achievements_unlocked)
  const players = count(row.players_with_achievements)
  const consistent = achievements !== null && players !== null && players <= achievements
  return {
    achievementsUnlocked: consistent ? achievements : null,
    playersWithAchievements: consistent ? players : null,
    diceUnlocks: valid('invalid_player_documents', 'invalid_dice_shapes', 'invalid_dice_entries')
      ? count(row.dice_unlocks) : null,
    expansionUnlocks: valid('invalid_player_documents', 'invalid_expansion_shapes', 'invalid_expansion_entries')
      ? count(row.expansion_unlocks) : null,
  }
}

const SQL = [
  'SELECT achievements_unlocked, players_with_achievements, dice_unlocks, expansion_unlocks,',
  ' invalid_player_documents, invalid_dice_shapes, invalid_dice_entries,',
  ' invalid_expansion_shapes, invalid_expansion_entries',
  'FROM babuni_admin_ro.progression_ownership_totals',
  'LIMIT 2',
].join('\n')

// Called inside the existing read-only snapshot transaction. A missing optional
// view must not abort the original overview or player preview.
export async function readProgression(client, config) {
  if (!progressionApproved(config)) return unavailableProgression()
  await client.query('SAVEPOINT progression_metrics')
  try {
    const result = await client.query(SQL)
    await client.query('RELEASE SAVEPOINT progression_metrics')
    return normalizeProgression(result.rows)
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT progression_metrics')
    await client.query('RELEASE SAVEPOINT progression_metrics')
    if (['42P01', '42501', '42703', '42804', '42883', '22P02', '22003', '57014']
      .includes(error?.code)) return unavailableProgression()
    throw error
  }
}
