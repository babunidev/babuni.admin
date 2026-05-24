import type { ReactNode } from 'react'
import { encounterImageUrl, useLocalContent } from '../config/constants'
import type { EncounterData } from '../types/gameContent'
import {
  ENCOUNTER_TYPES,
  REWARD_TYPES,
  SOLUTION_TYPE_GROUPS,
} from '../utils/gameDataReference'
import { ImageUploadField } from './ImageUploadField'

const inputClass =
  'w-full rounded border border-gold/20 bg-ash px-3 py-2 text-sm text-parchment'

function EditorSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-gold/10 pb-5 last:border-0 last:pb-0">
      <h3 className="text-xs font-medium uppercase tracking-widest text-gold-bright">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs text-fog">{description}</p>
      )}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm text-fog">
      {label}
      {hint && <span className="mt-0.5 block text-xs text-fog/80">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function NumberSelect({
  value,
  onChange,
  options,
  groups,
}: {
  value: number
  onChange: (value: number) => void
  options?: { value: number; label: string }[]
  groups?: typeof SOLUTION_TYPE_GROUPS
}) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {groups?.map((group) => (
        <optgroup key={group.group} label={group.group}>
          {group.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

const SLOTS = ['A', 'B', 'C', 'D'] as const

type SlotKey = 'A' | 'B' | 'C' | 'D'

function solutionIdKey(slot: SlotKey): keyof EncounterData {
  return `mEncounterSolutiuon${slot}` as keyof EncounterData
}

function solutionTypeKey(slot: SlotKey): keyof EncounterData {
  return `mEncounterSolutiuonType${slot}` as keyof EncounterData
}

interface EncounterEditorPanelProps {
  mode: 'add' | 'edit'
  storageKey?: string
  draft: EncounterData
  onChange: (draft: EncounterData) => void
  onSave: () => void
  onClose: () => void
  isSaving: boolean
  onUploadImage?: (file: File) => Promise<string | void>
}

export function EncounterEditorPanel({
  mode,
  storageKey,
  draft,
  onChange,
  onSave,
  onClose,
  isSaving,
  onUploadImage,
}: EncounterEditorPanelProps) {
  const previewSrc = encounterImageUrl(draft.mEncounterImageName)
  const jsonKey =
    storageKey ?? String(draft.mEncounterID).padStart(5, '0')

  const patch = (partial: Partial<EncounterData>) => {
    onChange({ ...draft, ...partial })
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-void/60 backdrop-blur-[1px]"
        aria-label="Close editor"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-gold/20 bg-slate shadow-2xl"
        role="dialog"
        aria-labelledby="encounter-editor-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <div>
            <h2
              id="encounter-editor-title"
              className="text-lg font-medium text-gold-bright"
            >
              {mode === 'edit' ? 'Edit encounter' : 'Add encounter'}
            </h2>
            <p className="mt-1 text-xs text-fog">
              {mode === 'edit' ? 'Updates' : 'Saves as'} key{' '}
              <span className="font-mono text-parchment">{jsonKey}</span> in
              encountersdata.json
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-gold/20 px-2 py-1 text-xs text-fog hover:bg-ash/60 hover:text-parchment"
          >
            Close
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            <EditorSection title="Basics">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Encounter ID"
                  hint={
                    mode === 'edit'
                      ? 'Fixed while editing — JSON key stays the same.'
                      : 'JSON key is zero-padded to 5 digits.'
                  }
                >
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.mEncounterID}
                    disabled={mode === 'edit'}
                    onChange={(e) =>
                      patch({ mEncounterID: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Title">
                  <input
                    className={inputClass}
                    value={draft.mEncounterTitle}
                    onChange={(e) =>
                      patch({ mEncounterTitle: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Encounter type"
                  hint="1 Combat · 2 Trick · 3 Help · 4 Learn · 5 Trade"
                >
                  <NumberSelect
                    value={draft.mEncounterType}
                    onChange={(v) => patch({ mEncounterType: v })}
                    options={ENCOUNTER_TYPES}
                  />
                </Field>
                <Field label="Difficulty">
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.mEncounterDifficulty}
                    onChange={(e) =>
                      patch({ mEncounterDifficulty: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Expansion ID" hint="0 = base game; matches expansiondata.">
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.mEncounterExpansion}
                    onChange={(e) =>
                      patch({ mEncounterExpansion: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Follow encounter ID" hint="0 = none; chain to next encounter.">
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.mEncounterFollow}
                    onChange={(e) =>
                      patch({ mEncounterFollow: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
            </EditorSection>

            <EditorSection
              title="Story"
              description="Shown to the player when the encounter starts."
            >
              <Field label="Encounter text">
                <textarea
                  className={inputClass}
                  rows={8}
                  value={draft.mEncounterText}
                  onChange={(e) => patch({ mEncounterText: e.target.value })}
                />
              </Field>
            </EditorSection>

            <EditorSection
              title="Image"
              description={
                useLocalContent && onUploadImage
                  ? 'Choosing a file copies it into encounterimages/ as WebP. The name is generated from the encounter title (2_title, 3_title, … if that name already exists).'
                  : undefined
              }
            >
              <Field
                label="Image name (no .webp)"
                hint="Set manually or filled automatically when you upload."
              >
                <input
                  className={inputClass}
                  value={draft.mEncounterImageName}
                  onChange={(e) =>
                    patch({ mEncounterImageName: e.target.value })
                  }
                />
              </Field>
              {previewSrc && (
                <img
                  src={previewSrc}
                  alt=""
                  className="max-h-40 w-full rounded-lg border border-gold/15 object-cover"
                />
              )}
              {useLocalContent && onUploadImage && (
                <ImageUploadField
                  label="Choose encounter image"
                  fileName={draft.mEncounterImageName}
                  onUpload={async (file) => {
                    const imageName = await onUploadImage(file)
                    if (imageName) patch({ mEncounterImageName: imageName })
                  }}
                />
              )}
            </EditorSection>

            <EditorSection
              title="Reward"
              description="1 Skills · 2 Items · 3 Epic & currency · 4 Other"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Reward type">
                  <NumberSelect
                    value={draft.mEncounterRewardType}
                    onChange={(v) => patch({ mEncounterRewardType: v })}
                    options={REWARD_TYPES}
                  />
                </Field>
                <Field label="Reward amount">
                  <input
                    type="number"
                    className={inputClass}
                    value={draft.mEncounterRewardAmount}
                    onChange={(e) =>
                      patch({ mEncounterRewardAmount: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
            </EditorSection>

            <EditorSection
              title="Solution slots (A–D)"
              description="Primary = specific solution ID from solutiondata. Secondary = any solution of that type (0 = none)."
            >
              {SLOTS.map((slot) => (
                <div
                  key={slot}
                  className="rounded-lg border border-gold/10 bg-void/30 p-3"
                >
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gold-bright/90">
                    Slot {slot}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Primary solution ID">
                      <input
                        type="number"
                        className={inputClass}
                        value={draft[solutionIdKey(slot)] as number}
                        onChange={(e) =>
                          patch({
                            [solutionIdKey(slot)]: Number(e.target.value),
                          } as Partial<EncounterData>)
                        }
                      />
                    </Field>
                    <Field label="Secondary solution type">
                      <NumberSelect
                        value={draft[solutionTypeKey(slot)] as number}
                        onChange={(v) =>
                          patch({
                            [solutionTypeKey(slot)]: v,
                          } as Partial<EncounterData>)
                        }
                        groups={SOLUTION_TYPE_GROUPS}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </EditorSection>
          </div>
        </div>

        <footer className="shrink-0 border-t border-gold/15 px-5 py-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="w-full rounded border border-gold/30 bg-gold/15 px-4 py-2.5 text-sm font-medium text-gold-bright transition hover:bg-gold/25 disabled:opacity-50"
          >
            {isSaving
              ? 'Saving…'
              : mode === 'edit'
                ? 'Save changes'
                : 'Save encounter'}
          </button>
        </footer>
      </aside>
    </>
  )
}
