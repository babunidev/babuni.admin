/** Labels for admin UI — aligned with Morkahja game data conventions. */

import type { EncounterData } from '../types/gameContent'

export type LabeledOption = {
  value: number
  label: string
  hint?: string
}

export const ENCOUNTER_TYPES: LabeledOption[] = [
  { value: 1, label: '1 — Combat' },
  { value: 2, label: '2 — Trick' },
  { value: 3, label: '3 — Help' },
  { value: 4, label: '4 — Learn' },
  { value: 5, label: '5 — Trade' },
  { value: 66, label: '66 — Atranor (special)' },
  { value: 77, label: '77 — Level up (special)' },
]

export const REWARD_TYPES: LabeledOption[] = [
  { value: 1, label: '1 — Skills', hint: 'Basic reward: skills' },
  { value: 2, label: '2 — Items', hint: 'Basic reward: items' },
  {
    value: 3,
    label: '3 — Epic items & currency',
    hint: 'Epic items and currency',
  },
  { value: 4, label: '4 — Other items', hint: 'Other items' },
]

export const ROLE_REWARD_TYPES: LabeledOption[] = [
  { value: 37, label: '37 — Mage spellbook' },
  { value: 38, label: '38 — Warrior spellbook' },
  { value: 39, label: '39 — Rogue spellbook' },
]

export const RACE_REWARD_TYPES: LabeledOption[] = [
  { value: 40, label: '40 — Rokur spellbook' },
  { value: 41, label: '41 — Verdani spellbook' },
  { value: 42, label: '42 — Aevis spellbook' },
  { value: 43, label: '43 — Grimnir spellbook' },
]

export const SOLUTION_TYPE_GROUPS: {
  group: string
  options: LabeledOption[]
}[] = [
  {
    group: 'General',
    options: [
      { value: 0, label: '0 — None' },
      { value: 1, label: '1 — Learn skill (base 10001)' },
      { value: 2, label: '2 — Learn item' },
      { value: 3, label: '3 — Trade skill (base 10002)' },
      { value: 4, label: '4 — Trade item' },
      { value: 15, label: '15 — Treasure / life / essence item' },
      { value: 16, label: '16 — Life skill' },
      { value: 76, label: '76 — Resurrection skill' },
      { value: 77, label: '77 — Resurrection item' },
    ],
  },
  {
    group: 'Trick — Find',
    options: [
      { value: 5, label: '5 — Find skill (base 10003)' },
      { value: 6, label: '6 — Find item' },
    ],
  },
  {
    group: 'Trick — Unlock',
    options: [
      { value: 7, label: '7 — Open lock skill (base 10004, Rogue)' },
      { value: 8, label: '8 — Open lock item' },
    ],
  },
  {
    group: 'Trick — Climb',
    options: [
      { value: 13, label: '13 — Climb skill (base 10070)' },
      { value: 14, label: '14 — Climb item' },
    ],
  },
  {
    group: 'Trick — Speak',
    options: [
      { value: 17, label: '17 — Speechcraft skill (base 10129)' },
      { value: 18, label: '18 — Speechcraft item' },
    ],
  },
  {
    group: 'Combat',
    options: [
      { value: 9, label: '9 — Combat skill (base 10034)' },
      { value: 10, label: '10 — Combat item' },
      { value: 27, label: '27 — Purge skill (base 10078)' },
      { value: 28, label: '28 — Purge item' },
      { value: 29, label: '29 — Hunting skill (base 10079)' },
      { value: 30, label: '30 — Hunting item' },
      { value: 35, label: '35 — Stealth skill (base 10133)' },
      { value: 36, label: '36 — Stealth item' },
    ],
  },
  {
    group: 'Aid',
    options: [
      { value: 21, label: '21 — Heal skill (base 10033)' },
      { value: 22, label: '22 — Heal item' },
      { value: 25, label: '25 — Help / protect skill (base 10072)' },
      { value: 26, label: '26 — Help / protect item' },
      { value: 33, label: '33 — Nurture skill (base 10076)' },
      { value: 34, label: '34 — Nurture item' },
      { value: 39, label: '39 — Inspiration skill (base 10146)' },
      { value: 40, label: '40 — Inspiration item' },
    ],
  },
]

const encounterTypeMap = new Map(
  ENCOUNTER_TYPES.map((entry) => [entry.value, entry.label]),
)
const rewardTypeMap = new Map(
  [...REWARD_TYPES, ...ROLE_REWARD_TYPES, ...RACE_REWARD_TYPES].map(
    (entry) => [entry.value, entry.label],
  ),
)
const solutionTypeMap = new Map<number, string>()
for (const group of SOLUTION_TYPE_GROUPS) {
  for (const option of group.options) {
    solutionTypeMap.set(option.value, option.label)
  }
}

export function formatEncounterTypeLabel(type: number): string {
  const label = encounterTypeMap.get(type)
  return label ?? `Type ${type}`
}

export function formatRewardTypeLabel(type: number): string {
  const label = rewardTypeMap.get(type)
  return label ?? `Reward type ${type}`
}

export function formatSolutionTypeLabel(type: number): string {
  if (type === 0) return 'None'
  const label = solutionTypeMap.get(type)
  return label ?? `Solution type ${type}`
}

export function createDefaultEncounterDraft(): EncounterData {
  return {
    mEncounterDifficulty: 1,
    mEncounterExpansion: 0,
    mEncounterFollow: 0,
    mEncounterID: 90001,
    mEncounterImageName: 'new_encounter',
    mEncounterRewardAmount: 1,
    mEncounterRewardType: 1,
    mEncounterSolutiuonA: 0,
    mEncounterSolutiuonB: 0,
    mEncounterSolutiuonC: 0,
    mEncounterSolutiuonD: 0,
    mEncounterSolutiuonTypeA: 0,
    mEncounterSolutiuonTypeB: 0,
    mEncounterSolutiuonTypeC: 0,
    mEncounterSolutiuonTypeD: 0,
    mEncounterText: '',
    mEncounterTitle: 'New encounter',
    mEncounterType: 1,
  }
}
