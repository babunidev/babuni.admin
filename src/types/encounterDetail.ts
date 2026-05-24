import type { EncounterData, SolutionData } from './gameContent'

export interface EncounterSolutionSlotDetail {
  slot: 'A' | 'B' | 'C' | 'D'
  primarySolutionId: number
  secondarySolutionType: number
  /** Resolved from solutiondata when primary ID is set */
  primarySolution?: SolutionData
  /** Example solution of required type when slot uses type-only requirement */
  secondaryTypeExample?: SolutionData
}

export interface EncounterDetail {
  key: string
  encounter: EncounterData
  expansionName?: string
  followEncounter?: { key: string; title: string; id: number }
  slots: EncounterSolutionSlotDetail[]
}
