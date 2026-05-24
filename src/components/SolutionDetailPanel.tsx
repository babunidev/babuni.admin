import { useMemo } from 'react'
import {
  encounterImageUrl,
  solutionImageUrl,
} from '../config/constants'
import type { EncounterData, EncounterMap, SolutionData } from '../types/gameContent'
import { ContentDetailPanel } from './ContentDetailPanel'

interface SolutionDetailPanelProps {
  keyId: string
  solution: SolutionData
  encounters: EncounterMap
  onClose: () => void
}

export function SolutionDetailPanel({
  keyId,
  solution,
  encounters,
  onClose,
}: SolutionDetailPanelProps) {
  const usedInEncounters = useMemo(() => {
    const matches: Array<{ key: string; encounter: EncounterData }> = []
    for (const [key, encounter] of Object.entries(encounters)) {
      const ids = [
        encounter.mEncounterSolutiuonA,
        encounter.mEncounterSolutiuonB,
        encounter.mEncounterSolutiuonC,
        encounter.mEncounterSolutiuonD,
      ]
      const types = [
        encounter.mEncounterSolutiuonTypeA,
        encounter.mEncounterSolutiuonTypeB,
        encounter.mEncounterSolutiuonTypeC,
        encounter.mEncounterSolutiuonTypeD,
      ]
      if (
        ids.includes(solution.mSolutionID) ||
        types.includes(solution.mSolutionType)
      ) {
        matches.push({ key, encounter })
      }
    }
    return matches.slice(0, 24)
  }, [encounters, solution.mSolutionID, solution.mSolutionType])

  return (
    <ContentDetailPanel
      title={solution.mSolutionName}
      subtitle={`Key ${keyId} · ID ${solution.mSolutionID}`}
      imageSrc={solutionImageUrl(solution.mSolutionIconName)}
      imageClassName="mx-auto max-h-32 w-32 rounded-lg border border-gold/15 object-cover"
      textSection={{
        title: 'Description',
        body: solution.mSolutionText,
      }}
      fields={[
        { label: 'JSON key', value: keyId },
        { label: 'Solution ID', value: String(solution.mSolutionID) },
        { label: 'Type', value: String(solution.mSolutionType) },
        { label: 'Uses', value: String(solution.mSolutionUses) },
        { label: 'Inventory type', value: String(solution.mSolutionInventoryType) },
        { label: 'Reward type', value: String(solution.mSolutionRewardType) },
        {
          label: 'Icon file',
          value: `${solution.mSolutionIconName}.webp`,
        },
      ]}
      rawJson={solution}
      onClose={onClose}
    >
      {usedInEncounters.length > 0 && (
        <section className="border-b border-gold/10 pb-5">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-gold-bright">
            Used in encounters ({usedInEncounters.length}
            {usedInEncounters.length >= 24 ? '+' : ''})
          </h3>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {usedInEncounters.map(({ key, encounter }) => {
              const src = encounterImageUrl(encounter.mEncounterImageName)
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-md border border-gold/10 bg-void/30 px-3 py-2 text-sm"
                >
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <span className="text-parchment">
                    {encounter.mEncounterTitle}{' '}
                    <span className="text-fog">#{encounter.mEncounterID}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </ContentDetailPanel>
  )
}
