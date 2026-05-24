import type {
  EncounterData,
  EncounterMap,
  ExpansionDataFile,
  SolutionData,
  SolutionMap,
} from '../types/gameContent'
import type {
  EncounterDetail,
  EncounterSolutionSlotDetail,
} from '../types/encounterDetail'
import {
  formatEncounterTypeLabel,
  formatRewardTypeLabel,
  formatSolutionTypeLabel,
} from './gameDataReference'

export function formatEncounterType(type: number): string {
  return formatEncounterTypeLabel(type)
}

export function formatRewardType(type: number): string {
  return formatRewardTypeLabel(type)
}

export { formatSolutionTypeLabel }

export function findSolutionById(
  solutions: SolutionMap,
  id: number,
): SolutionData | undefined {
  if (id <= 0) return undefined

  const candidates = [String(id), String(id).padStart(5, '0')]
  for (const key of candidates) {
    if (solutions[key]) return solutions[key]
  }

  return Object.values(solutions).find(
    (solution) => solution.mSolutionID === id,
  )
}

export function findSolutionByType(
  solutions: SolutionMap,
  solutionType: number,
): SolutionData | undefined {
  if (solutionType <= 0) return undefined
  return Object.values(solutions).find(
    (solution) => solution.mSolutionType === solutionType,
  )
}

function findEncounterKey(
  encounters: EncounterMap,
  encounterId: number,
): string | undefined {
  if (encounterId <= 0) return undefined

  const padded = String(encounterId).padStart(5, '0')
  if (encounters[padded]) return padded

  const direct = String(encounterId)
  if (encounters[direct]) return direct

  return Object.entries(encounters).find(
    ([, row]) => row.mEncounterID === encounterId,
  )?.[0]
}

function buildSlots(
  encounter: EncounterData,
  solutions: SolutionMap,
): EncounterSolutionSlotDetail[] {
  const config: Array<{
    slot: EncounterSolutionSlotDetail['slot']
    primarySolutionId: number
    secondarySolutionType: number
  }> = [
    {
      slot: 'A',
      primarySolutionId: encounter.mEncounterSolutiuonA,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeA,
    },
    {
      slot: 'B',
      primarySolutionId: encounter.mEncounterSolutiuonB,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeB,
    },
    {
      slot: 'C',
      primarySolutionId: encounter.mEncounterSolutiuonC,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeC,
    },
    {
      slot: 'D',
      primarySolutionId: encounter.mEncounterSolutiuonD,
      secondarySolutionType: encounter.mEncounterSolutiuonTypeD,
    },
  ]

  return config.map(({ slot, primarySolutionId, secondarySolutionType }) => ({
    slot,
    primarySolutionId,
    secondarySolutionType,
    primarySolution: findSolutionById(solutions, primarySolutionId),
    secondaryTypeExample: findSolutionByType(solutions, secondarySolutionType),
  }))
}

export function buildEncounterDetail(
  key: string,
  encounter: EncounterData,
  solutions: SolutionMap,
  encounters: EncounterMap,
  expansions?: ExpansionDataFile,
): EncounterDetail {
  const expansionEntry = expansions?.expansions
    ? Object.values(expansions.expansions).find(
        (row) => row.mExtensioID === encounter.mEncounterExpansion,
      )
    : undefined

  let followEncounter: EncounterDetail['followEncounter']
  if (encounter.mEncounterFollow > 0) {
    const followKey = findEncounterKey(encounters, encounter.mEncounterFollow)
    const followRow = followKey ? encounters[followKey] : undefined
    if (followKey && followRow) {
      followEncounter = {
        key: followKey,
        title: followRow.mEncounterTitle,
        id: followRow.mEncounterID,
      }
    }
  }

  return {
    key,
    encounter,
    expansionName: expansionEntry?.mExtensioName,
    followEncounter,
    slots: buildSlots(encounter, solutions),
  }
}
