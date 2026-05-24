/** Shapes aligned with MorkahjaWebApp `public/game/*.json` */

export interface EncounterData {
  mEncounterDifficulty: number
  mEncounterExpansion: number
  mEncounterFollow: number
  mEncounterID: number
  mEncounterImageName: string
  mEncounterRewardAmount: number
  mEncounterRewardType: number
  mEncounterSolutiuonA: number
  mEncounterSolutiuonB: number
  mEncounterSolutiuonC: number
  mEncounterSolutiuonD: number
  mEncounterSolutiuonTypeA: number
  mEncounterSolutiuonTypeB: number
  mEncounterSolutiuonTypeC: number
  mEncounterSolutiuonTypeD: number
  mEncounterText: string
  mEncounterTitle: string
  mEncounterType: number
}

export interface SolutionData {
  mSolutionID: number
  mSolutionIconName: string
  mSolutionInventoryType: number
  mSolutionName: string
  mSolutionRewardType: number
  mSolutionText: string
  mSolutionType: number
  mSolutionUses: number
}

export interface ExpansionData {
  mExtensioActive: boolean
  mExtensioCollectionImage: string
  mExtensioCost: number
  mExtensioHeaderImage: string
  mExtensioID: number
  mExtensioName: string
  mExtensioReward: number
  mExtensioSummaryText: string
  mExtensioText: string
  mExtensioUnlockButton: string
}

export interface FrameData {
  frameGem: number
  frameID: number
  frameRace: number
  frameRole: number
  frameType: number
}

export interface PortraitData {
  avatarGems: number
  avatarGenderID: number
  avatarID: number
  avatarName: string
  avatarRace: number
  avatarRole: number
  avatarType: number
}

export type EncounterMap = Record<string, EncounterData>
export type SolutionMap = Record<string, SolutionData>

export interface ExpansionDataFile {
  expansions: Record<string, ExpansionData>
}

export interface FramesDataFile {
  Frames: Array<FrameData | null>
}

export interface PortraitsDataFile {
  Avatar: Array<PortraitData | null>
}

export type ContentKind =
  | 'encounters'
  | 'solutions'
  | 'expansions'
  | 'frames'
  | 'portraits'
