import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  encounterImageUrl,
  solutionImageUrl,
} from '../config/constants'
import type { EncounterDetail, EncounterSolutionSlotDetail } from '../types/encounterDetail'
import type { SolutionData } from '../types/gameContent'
import {
  formatEncounterType,
  formatRewardType,
  formatSolutionTypeLabel,
} from '../utils/encounterDetail'

interface EncounterDetailPanelProps {
  detail: EncounterDetail
  onClose: () => void
  onEdit?: () => void
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-gold/10 pb-5 last:border-0 last:pb-0">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-gold-bright">
        {title}
      </h3>
      {children}
    </section>
  )
}

function StatGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-gold/10 bg-void/40 px-3 py-2"
        >
          <dt className="text-[10px] uppercase tracking-wider text-fog">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-sm text-parchment">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SolutionCard({
  solution,
  badge,
}: {
  solution: SolutionData
  badge: string
}) {
  const iconSrc = solutionImageUrl(solution.mSolutionIconName)

  return (
    <div className="rounded-md border border-gold/15 bg-void/30 p-3">
      <div className="flex gap-3">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className="h-12 w-12 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-ash text-[10px] text-fog">
            ?
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-gold-bright/80">
            {badge}
          </p>
          <p className="font-medium text-parchment">
            {solution.mSolutionName}{' '}
            <span className="text-fog">#{solution.mSolutionID}</span>
          </p>
          <p className="mt-1 text-xs text-fog">
            Type {solution.mSolutionType} · Uses {solution.mSolutionUses} ·
            Inventory {solution.mSolutionInventoryType}
          </p>
        </div>
      </div>
      {solution.mSolutionText && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-parchment/90">
          {solution.mSolutionText}
        </p>
      )}
    </div>
  )
}

function SlotBlock({ slot }: { slot: EncounterSolutionSlotDetail }) {
  const hasRequirement =
    slot.primarySolutionId > 0 || slot.secondarySolutionType > 0

  if (!hasRequirement) {
    return (
      <p className="text-sm text-fog">
        Slot {slot.slot}: <span className="text-parchment/70">—</span>
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-fog">
        Slot {slot.slot}
      </p>
      {slot.primarySolutionId > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-fog">
            Requires solution ID{' '}
            <span className="font-mono text-parchment">
              {slot.primarySolutionId}
            </span>
          </p>
          {slot.primarySolution ? (
            <SolutionCard solution={slot.primarySolution} badge="Primary" />
          ) : (
            <p className="rounded border border-ember/30 bg-ember/10 px-3 py-2 text-xs text-red-300/90">
              Solution {slot.primarySolutionId} not found in solutiondata.json
            </p>
          )}
        </div>
      )}
      {slot.secondarySolutionType > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-fog">
            Or any solution of type:{' '}
            <span className="text-parchment">
              {formatSolutionTypeLabel(slot.secondarySolutionType)}
            </span>
          </p>
          {slot.secondaryTypeExample ? (
            <SolutionCard
              solution={slot.secondaryTypeExample}
              badge="Type example"
            />
          ) : (
            <p className="text-xs text-fog">
              No solution with this type in the database.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function EncounterDetailPanel({
  detail,
  onClose,
  onEdit,
}: EncounterDetailPanelProps) {
  const navigate = useNavigate()
  const { encounter } = detail
  const imageSrc = encounterImageUrl(encounter.mEncounterImageName)

  const activeSlots = useMemo(
    () =>
      detail.slots.filter(
        (slot) => slot.primarySolutionId > 0 || slot.secondarySolutionType > 0,
      ),
    [detail.slots],
  )

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[1px]"
        aria-label="Close encounter details"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-gold/20 bg-slate shadow-2xl"
        role="dialog"
        aria-labelledby="encounter-detail-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="encounter-detail-title"
              className="truncate text-lg font-medium text-gold-bright"
            >
              {encounter.mEncounterTitle}
            </h2>
            <p className="mt-1 font-mono text-xs text-fog">
              Key {detail.key} · ID {encounter.mEncounterID}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded border border-gold/30 bg-gold/15 px-3 py-1 text-xs text-gold-bright hover:bg-gold/25"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gold/20 px-2 py-1 text-xs text-fog hover:bg-ash/60 hover:text-parchment"
            >
              Close
            </button>
          </div>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            {imageSrc && (
              <img
                src={imageSrc}
                alt=""
                className="max-h-48 w-full rounded-lg border border-gold/15 object-cover"
              />
            )}

            <DetailSection title="Story text">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-parchment/95">
                {encounter.mEncounterText || (
                  <span className="text-fog">No text.</span>
                )}
              </p>
            </DetailSection>

            <DetailSection title="Metadata">
              <StatGrid
                items={[
                  { label: 'JSON key', value: detail.key },
                  { label: 'Encounter ID', value: String(encounter.mEncounterID) },
                  {
                    label: 'Type',
                    value: formatEncounterType(encounter.mEncounterType),
                  },
                  {
                    label: 'Difficulty',
                    value: String(encounter.mEncounterDifficulty),
                  },
                  {
                    label: 'Expansion',
                    value: detail.expansionName
                      ? `${detail.expansionName} (${encounter.mEncounterExpansion})`
                      : String(encounter.mEncounterExpansion),
                  },
                  {
                    label: 'Follow encounter',
                    value: detail.followEncounter
                      ? `${detail.followEncounter.title} (#${detail.followEncounter.id})`
                      : encounter.mEncounterFollow > 0
                        ? `#${encounter.mEncounterFollow} (not in data)`
                        : 'None',
                  },
                  {
                    label: 'Reward',
                    value: `${encounter.mEncounterRewardAmount} × ${formatRewardType(encounter.mEncounterRewardType)}`,
                  },
                  {
                    label: 'Image file',
                    value: `${encounter.mEncounterImageName}.webp`,
                  },
                ]}
              />
              {detail.followEncounter && (
                <button
                  type="button"
                  className="mt-3 text-sm text-gold-bright hover:underline"
                  onClick={() =>
                    navigate(
                      `/content/encounters/${encodeURIComponent(detail.followEncounter!.key)}`,
                    )
                  }
                >
                  Open follow-up: {detail.followEncounter.title}
                </button>
              )}
            </DetailSection>

            <DetailSection
              title={`Solutions (${activeSlots.length} active slot${activeSlots.length === 1 ? '' : 's'})`}
            >
              {activeSlots.length === 0 ? (
                <p className="text-sm text-fog">
                  No solution requirements on slots A–D.
                </p>
              ) : (
                <div className="space-y-5">
                  {detail.slots.map((slot) => (
                    <SlotBlock key={slot.slot} slot={slot} />
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection title="Raw fields">
              <pre className="overflow-x-auto rounded border border-gold/10 bg-void/50 p-3 text-[11px] leading-relaxed text-parchment/80">
                {JSON.stringify(encounter, null, 2)}
              </pre>
            </DetailSection>
          </div>
        </div>
      </aside>
    </>
  )
}
