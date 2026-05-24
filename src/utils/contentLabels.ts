const RACE_LABELS: Record<number, string> = {
  0: 'Any',
  1: 'Grimnir',
  2: 'Verdani',
  3: 'Aevis',
  4: 'Rokur',
}

const ROLE_LABELS: Record<number, string> = {
  0: 'Any',
  1: 'Mage',
  2: 'Rogue',
  3: 'Warrior',
}

const GENDER_LABELS: Record<number, string> = {
  1: 'Male',
  2: 'Female',
}

export function formatRaceId(id: number): string {
  return RACE_LABELS[id] ?? String(id)
}

export function formatRoleId(id: number): string {
  return ROLE_LABELS[id] ?? String(id)
}

export function formatGenderId(id: number): string {
  return GENDER_LABELS[id] ?? String(id)
}
