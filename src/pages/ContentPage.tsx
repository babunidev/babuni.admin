import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentDetailPanel } from '../components/ContentDetailPanel'
import {
  ContentImageGrid,
  type ContentGridItem,
} from '../components/ContentImageGrid'
import { EncounterDetailPanel } from '../components/EncounterDetailPanel'
import { EncounterEditorPanel } from '../components/EncounterEditorPanel'
import { PageHeader } from '../components/PageHeader'
import { SolutionDetailPanel } from '../components/SolutionDetailPanel'
import { Table, type Column } from '../components/Table'
import { buildEncounterDetail } from '../utils/encounterDetail'
import { createDefaultEncounterDraft } from '../utils/gameDataReference'
import {
  formatGenderId,
  formatRaceId,
  formatRoleId,
} from '../utils/contentLabels'
import { ImageUploadField } from '../components/ImageUploadField'
import {
  encounterImageUrl,
  expansionImageUrl,
  frameImageUrl,
  gameDataBaseUrl,
  portraitImageUrl,
  solutionImageUrl,
  useLocalContent,
} from '../config/constants'
import {
  createEncounter,
  createExpansion,
  createFrame,
  createPortrait,
  createSolution,
  fetchEncounters,
  fetchExpansions,
  fetchFrames,
  fetchPortraits,
  fetchSolutions,
  uploadEncounterImageFromTitle,
  uploadSolutionImage,
} from '../services/contentApi'
import type {
  EncounterData,
  ExpansionData,
  FrameData,
  PortraitData,
  SolutionData,
} from '../types/gameContent'

type Tab = 'encounters' | 'solutions' | 'expansions' | 'frames' | 'portraits'

const tabs: { id: Tab; label: string }[] = [
  { id: 'encounters', label: 'Encounters' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'expansions', label: 'Expansions' },
  { id: 'frames', label: 'Frames' },
  { id: 'portraits', label: 'Portraits' },
]

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm text-fog">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputClass =
  'w-full rounded border border-gold/20 bg-ash px-3 py-2 text-sm text-parchment'

export function ContentPage() {
  const { kind: kindParam, itemKey } = useParams<{
    kind?: string
    itemKey?: string
  }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('encounters')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const detailKind =
    kindParam && tabs.some((entry) => entry.id === kindParam)
      ? (kindParam as Tab)
      : undefined

  useEffect(() => {
    if (detailKind) setTab(detailKind)
  }, [detailKind])

  const closeDetail = () => navigate('/content')
  const openItem = (contentTab: Tab, key: string) => {
    navigate(`/content/${contentTab}/${encodeURIComponent(key)}`)
  }

  const encountersQuery = useQuery({
    queryKey: ['content', 'encounters'],
    queryFn: fetchEncounters,
    enabled:
      tab === 'encounters' ||
      tab === 'solutions' ||
      detailKind === 'encounters' ||
      detailKind === 'solutions',
  })
  const solutionsQuery = useQuery({
    queryKey: ['content', 'solutions'],
    queryFn: fetchSolutions,
    enabled:
      tab === 'solutions' ||
      tab === 'encounters' ||
      detailKind === 'solutions',
  })
  const expansionsQuery = useQuery({
    queryKey: ['content', 'expansions'],
    queryFn: fetchExpansions,
    enabled:
      tab === 'expansions' ||
      tab === 'encounters' ||
      detailKind === 'expansions',
  })
  const framesQuery = useQuery({
    queryKey: ['content', 'frames'],
    queryFn: fetchFrames,
    enabled: tab === 'frames' || detailKind === 'frames',
  })
  const portraitsQuery = useQuery({
    queryKey: ['content', 'portraits'],
    queryFn: fetchPortraits,
    enabled: tab === 'portraits' || detailKind === 'portraits',
  })

  const encounterRows = useMemo(() => {
    const map = encountersQuery.data ?? {}
    return Object.entries(map)
      .map(([key, row]) => ({ key, ...row }))
      .filter((row) => {
        const q = search.toLowerCase()
        return (
          row.key.includes(q) ||
          row.mEncounterTitle.toLowerCase().includes(q) ||
          String(row.mEncounterID).includes(q)
        )
      })
      .slice(0, 100)
  }, [encountersQuery.data, search])

  const solutionGridItems = useMemo((): ContentGridItem[] => {
    const map = solutionsQuery.data ?? {}
    const q = search.toLowerCase()
    return Object.entries(map)
      .filter(([key, row]) => {
        if (!q) return true
        return (
          key.includes(q) ||
          row.mSolutionName.toLowerCase().includes(q) ||
          String(row.mSolutionID).includes(q) ||
          row.mSolutionIconName.toLowerCase().includes(q)
        )
      })
      .map(([key, row]) => ({
        id: key,
        imageSrc: solutionImageUrl(row.mSolutionIconName),
        title: row.mSolutionName,
      }))
  }, [solutionsQuery.data, search])

  const selectedEncounterDetail = useMemo(() => {
    if (detailKind !== 'encounters' || !itemKey || !encountersQuery.data) {
      return null
    }
    const encounter = encountersQuery.data[itemKey]
    if (!encounter) return null
    return buildEncounterDetail(
      itemKey,
      encounter,
      solutionsQuery.data ?? {},
      encountersQuery.data,
      expansionsQuery.data,
    )
  }, [
    detailKind,
    itemKey,
    encountersQuery.data,
    solutionsQuery.data,
    expansionsQuery.data,
  ])

  const selectedSolution = useMemo(() => {
    if (detailKind !== 'solutions' || !itemKey || !solutionsQuery.data) {
      return null
    }
    const solution = solutionsQuery.data[itemKey]
    if (!solution) return null
    return { key: itemKey, solution }
  }, [detailKind, itemKey, solutionsQuery.data])

  const encounterColumns: Column<(EncounterData & { key: string })>[] = [
    { key: 'key', header: 'Key', className: 'font-mono text-xs' },
    { key: 'mEncounterID', header: 'ID', className: 'tabular-nums' },
    {
      key: 'mEncounterTitle',
      header: 'Title',
      render: (row) => (
        <span className="font-medium text-gold-bright/90">{row.mEncounterTitle}</span>
      ),
    },
    {
      key: 'mEncounterImageName',
      header: 'Image',
      render: (row) => {
        const src = encounterImageUrl(row.mEncounterImageName)
        return src ? (
          <img src={src} alt="" className="h-10 w-16 rounded object-cover" />
        ) : (
          <span className="text-xs text-fog">{row.mEncounterImageName}</span>
        )
      },
    },
    { key: 'mEncounterType', header: 'Type', className: 'tabular-nums' },
    {
      key: '_edit',
      header: '',
      className: 'w-16 text-right',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            startEncounterEdit(row.key)
          }}
          className="rounded border border-gold/20 px-2 py-0.5 text-xs text-gold-bright hover:bg-gold/15"
        >
          Edit
        </button>
      ),
    },
  ]

  const [encounterEditorOpen, setEncounterEditorOpen] = useState(false)
  const [encounterEditKey, setEncounterEditKey] = useState<string | null>(null)
  const [encounterDraft, setEncounterDraft] = useState(createDefaultEncounterDraft)

  const openEncounterEditor = (key: string | null, data: EncounterData) => {
    setEncounterEditKey(key)
    setEncounterDraft({ ...data })
    setEncounterEditorOpen(true)
  }

  const closeEncounterEditor = () => {
    setEncounterEditorOpen(false)
    setEncounterEditKey(null)
  }

  const startEncounterEdit = (key: string) => {
    const data = encountersQuery.data?.[key]
    if (!data) return
    openEncounterEditor(key, data)
  }

  const [solutionDraft, setSolutionDraft] = useState<SolutionData>({
    mSolutionID: 90001,
    mSolutionIconName: 'skill_learn',
    mSolutionInventoryType: 1,
    mSolutionName: 'New solution',
    mSolutionRewardType: 1,
    mSolutionText: '',
    mSolutionType: 1,
    mSolutionUses: 1,
  })

  const saveEncounter = useMutation({
    mutationFn: async () => {
      const isEdit = Boolean(encounterEditKey)
      const key =
        encounterEditKey ?? String(encounterDraft.mEncounterID).padStart(5, '0')
      await createEncounter(key, encounterDraft)
      return { isEdit }
    },
    onSuccess: ({ isEdit: wasEdit }) => {
      closeEncounterEditor()
      setStatus(
        wasEdit
          ? useLocalContent
            ? 'Encounter updated in encountersdata.json.'
            : 'Encounter updated on VPS.'
          : useLocalContent
            ? 'Encounter saved to encountersdata.json on disk.'
            : 'Encounter saved on VPS.',
      )
      void queryClient.invalidateQueries({ queryKey: ['content', 'encounters'] })
    },
    onError: (err: Error) => setStatus(err.message),
  })

  const saveSolution = useMutation({
    mutationFn: () => {
      const key = String(solutionDraft.mSolutionID)
      return createSolution(key, solutionDraft)
    },
    onSuccess: () => {
      setStatus(
        useLocalContent
          ? 'Solution saved to solutiondata.json on disk.'
          : 'Solution saved on VPS.',
      )
      void queryClient.invalidateQueries({ queryKey: ['content', 'solutions'] })
    },
    onError: (err: Error) => setStatus(err.message),
  })

  const dataSourceHint = useLocalContent
    ? `Local files: MorkahjaWebApp/client/public/game + /UI (saves go to disk)`
    : gameDataBaseUrl
      ? `Loading from ${gameDataBaseUrl}`
      : 'No content source configured'

  return (
    <div>
      <PageHeader
        title="Content"
        description="Browse and add encounters, solutions, expansions, frames, and portraits."
      />
      <p className="mb-4 text-xs text-fog">{dataSourceHint}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setSearch('')
              setEncounterEditorOpen(false)
              setEncounterEditKey(null)
              if (itemKey) closeDetail()
            }}
            className={`rounded border px-3 py-1.5 text-sm transition ${
              tab === item.id
                ? 'border-gold/40 bg-gold/15 text-gold-bright'
                : 'border-gold/15 text-fog hover:text-parchment'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'encounters' ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, key, or title…"
            className={`${inputClass} min-w-[200px] flex-1 max-w-md`}
          />
          <button
            type="button"
            onClick={() => {
              if (itemKey) closeDetail()
              openEncounterEditor(null, createDefaultEncounterDraft())
            }}
            className="shrink-0 rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright transition hover:bg-gold/25"
          >
            Add encounter
          </button>
        </div>
      ) : (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === 'frames' || tab === 'portraits'
              ? 'Search by id, name, race, or role…'
              : 'Search by id, key, or title…'
          }
          className={`${inputClass} mb-4 max-w-md`}
        />
      )}

      {tab === 'encounters' && (
        <div className="space-y-8">
          <p className="text-xs text-fog/80">
            Click a row for details, Edit (or double-click) to change text, image, and
            fields. Use Add encounter for new content.
          </p>
          <Table
            columns={encounterColumns}
            data={encounterRows}
            keyField="key"
            selectedKey={detailKind === 'encounters' ? itemKey : undefined}
            onRowClick={(row) => openItem('encounters', row.key)}
            onRowDoubleClick={(row) => startEncounterEdit(row.key)}
            emptyMessage="No encounters loaded. Run npm run dev with VITE_USE_LOCAL_CONTENT=true."
          />
          {encounterEditorOpen && (
            <EncounterEditorPanel
              mode={encounterEditKey ? 'edit' : 'add'}
              storageKey={encounterEditKey ?? undefined}
              draft={encounterDraft}
              onChange={setEncounterDraft}
              onSave={() => saveEncounter.mutate()}
              onClose={closeEncounterEditor}
              isSaving={saveEncounter.isPending}
              onUploadImage={
                useLocalContent
                  ? (file) =>
                      uploadEncounterImageFromTitle(
                        encounterDraft.mEncounterTitle.trim() ||
                          `Encounter ${encounterDraft.mEncounterID}`,
                        encounterDraft.mEncounterID,
                        file,
                      )
                  : undefined
              }
            />
          )}
          {detailKind === 'encounters' &&
            itemKey &&
            selectedEncounterDetail &&
            !encounterEditorOpen && (
            <EncounterDetailPanel
              detail={selectedEncounterDetail}
              onClose={closeDetail}
              onEdit={() => startEncounterEdit(itemKey)}
            />
          )}
          {detailKind === 'encounters' &&
            itemKey &&
            !selectedEncounterDetail &&
            !encountersQuery.isLoading && (
              <p className="text-sm text-red-300/90">
                Encounter &quot;{itemKey}&quot; not found.
              </p>
            )}
        </div>
      )}

      {tab === 'solutions' && (
        <div className="space-y-8">
          <p className="text-xs text-fog/80">
            Click an icon to view full description and linked encounters.
          </p>
          <ContentImageGrid
            items={solutionGridItems}
            selectedId={detailKind === 'solutions' ? itemKey : undefined}
            onSelect={(key) => openItem('solutions', key)}
            emptyMessage="No solutions loaded."
          />
          {detailKind === 'solutions' && selectedSolution && (
            <SolutionDetailPanel
              keyId={selectedSolution.key}
              solution={selectedSolution.solution}
              encounters={encountersQuery.data ?? {}}
              onClose={closeDetail}
            />
          )}
          {detailKind === 'solutions' &&
            itemKey &&
            !selectedSolution &&
            !solutionsQuery.isLoading && (
              <p className="text-sm text-red-300/90">
                Solution &quot;{itemKey}&quot; not found.
              </p>
            )}
          <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
            <h2 className="text-sm uppercase tracking-widest text-gold-bright">
              Add solution
            </h2>
            <p className="mt-1 text-xs text-fog">
              Saves to <code className="text-gold-bright">solutiondata.json</code> and{' '}
              <code className="text-gold-bright">solutionimages/</code> on disk.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="ID">
                <input
                  type="number"
                  className={inputClass}
                  value={solutionDraft.mSolutionID}
                  onChange={(e) =>
                    setSolutionDraft((d) => ({
                      ...d,
                      mSolutionID: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Name">
                <input
                  className={inputClass}
                  value={solutionDraft.mSolutionName}
                  onChange={(e) =>
                    setSolutionDraft((d) => ({
                      ...d,
                      mSolutionName: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Icon name">
                <input
                  className={inputClass}
                  value={solutionDraft.mSolutionIconName}
                  onChange={(e) =>
                    setSolutionDraft((d) => ({
                      ...d,
                      mSolutionIconName: e.target.value,
                    }))
                  }
                />
              </Field>
              {useLocalContent && (
                <ImageUploadField
                  label="Upload solution icon (.webp)"
                  fileName={solutionDraft.mSolutionIconName}
                  onUpload={(file) =>
                    uploadSolutionImage(solutionDraft.mSolutionIconName, file)
                  }
                />
              )}
              <Field label="Uses">
                <input
                  type="number"
                  className={inputClass}
                  value={solutionDraft.mSolutionUses}
                  onChange={(e) =>
                    setSolutionDraft((d) => ({
                      ...d,
                      mSolutionUses: Number(e.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Text">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={solutionDraft.mSolutionText}
                  onChange={(e) =>
                    setSolutionDraft((d) => ({
                      ...d,
                      mSolutionText: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <button
              type="button"
              disabled={saveSolution.isPending}
              onClick={() => saveSolution.mutate()}
              className="mt-4 rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50"
            >
              Save solution
            </button>
          </section>
        </div>
      )}

      {tab === 'expansions' && (
        <ExpansionPanel
          data={expansionsQuery.data?.expansions ?? {}}
          search={search}
          selectedKey={detailKind === 'expansions' ? itemKey : undefined}
          onSelect={(key) => openItem('expansions', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'expansions' ? itemKey : undefined}
          onStatus={setStatus}
        />
      )}

      {tab === 'frames' && (
        <FramesPanel
          data={framesQuery.data?.Frames ?? []}
          search={search}
          selectedKey={detailKind === 'frames' ? itemKey : undefined}
          onSelect={(key) => openItem('frames', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'frames' ? itemKey : undefined}
          onStatus={setStatus}
        />
      )}

      {tab === 'portraits' && (
        <PortraitsPanel
          data={portraitsQuery.data?.Avatar ?? []}
          search={search}
          selectedKey={detailKind === 'portraits' ? itemKey : undefined}
          onSelect={(key) => openItem('portraits', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'portraits' ? itemKey : undefined}
          onStatus={setStatus}
        />
      )}

      {status && (
        <p className="mt-6 rounded border border-gold/20 bg-ash/60 px-4 py-3 text-sm text-parchment">
          {status}
        </p>
      )}
    </div>
  )
}

function ExpansionPanel({
  data,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
}: {
  data: Record<string, ExpansionData>
  search: string
  selectedKey?: string
  onSelect: (key: string) => void
  onCloseDetail: () => void
  detailKey?: string
  onStatus: (msg: string) => void
}) {
  const q = search.toLowerCase()
  const entries = Object.entries(data).filter(([key, row]) => {
    if (!q) return true
    return (
      key.includes(q) ||
      row.mExtensioName.toLowerCase().includes(q) ||
      String(row.mExtensioID).includes(q)
    )
  })

  const gridItems: ContentGridItem[] = entries.map(([key, row]) => ({
    id: key,
    imageSrc: expansionImageUrl(row.mExtensioCollectionImage),
    title: row.mExtensioName,
  }))

  const selected = detailKey ? data[detailKey] : undefined

  const [draft, setDraft] = useState<ExpansionData>({
    mExtensioActive: true,
    mExtensioCollectionImage: 'im_collection_expansion_new',
    mExtensioCost: 50,
    mExtensioHeaderImage: 'im_header_expansion_new',
    mExtensioID: 1010,
    mExtensioName: 'New expansion',
    mExtensioReward: 20,
    mExtensioSummaryText: 'New content pack',
    mExtensioText: '',
    mExtensioUnlockButton: 'im_unlock_expansion_new',
  })

  const save = useMutation({
    mutationFn: () => createExpansion(String(draft.mExtensioID), draft),
    onSuccess: () => onStatus('Expansion saved.'),
    onError: (err: Error) => onStatus(err.message),
  })

  return (
    <div className="space-y-6">
      <p className="text-xs text-fog/80">
        Click an image to view expansion text, costs, and assets.
      </p>
      <ContentImageGrid
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        columns="wide"
        emptyMessage="No expansions loaded."
      />
      {selected && detailKey && (
        <ContentDetailPanel
          title={selected.mExtensioName}
          subtitle={`Key ${detailKey} · ID ${selected.mExtensioID}`}
          imageSrc={expansionImageUrl(selected.mExtensioHeaderImage)}
          textSection={{
            title: 'Description',
            body: selected.mExtensioText,
          }}
          fields={[
            { label: 'JSON key', value: detailKey },
            { label: 'Expansion ID', value: String(selected.mExtensioID) },
            {
              label: 'Active in shop',
              value: selected.mExtensioActive ? 'Yes' : 'No',
            },
            { label: 'Gem cost', value: String(selected.mExtensioCost) },
            { label: 'Reward ID', value: String(selected.mExtensioReward) },
            { label: 'Summary', value: selected.mExtensioSummaryText },
            {
              label: 'Collection image',
              value: `${selected.mExtensioCollectionImage}.webp`,
            },
            {
              label: 'Header image',
              value: `${selected.mExtensioHeaderImage}.webp`,
            },
            {
              label: 'Unlock button',
              value: `${selected.mExtensioUnlockButton}.webp`,
            },
          ]}
          rawJson={selected}
          onClose={onCloseDetail}
        />
      )}
      <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold-bright">
          Add expansion
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.mExtensioName}
              onChange={(e) => setDraft((d) => ({ ...d, mExtensioName: e.target.value }))}
            />
          </Field>
          <Field label="ID">
            <input
              type="number"
              className={inputClass}
              value={draft.mExtensioID}
              onChange={(e) =>
                setDraft((d) => ({ ...d, mExtensioID: Number(e.target.value) }))
              }
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="mt-4 rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50"
        >
          Save expansion
        </button>
      </section>
    </div>
  )
}

function FramesPanel({
  data,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
}: {
  data: Array<FrameData | null>
  search: string
  selectedKey?: string
  onSelect: (key: string) => void
  onCloseDetail: () => void
  detailKey?: string
  onStatus: (msg: string) => void
}) {
  const q = search.toLowerCase()
  const frames = data.filter((row): row is FrameData => row !== null)

  const gridItems: ContentGridItem[] = frames
    .filter((row) => {
      if (!q) return true
      return (
        String(row.frameID).includes(q) ||
        formatRaceId(row.frameRace).toLowerCase().includes(q) ||
        formatRoleId(row.frameRole).toLowerCase().includes(q)
      )
    })
    .map((row) => ({
      id: String(row.frameID),
      imageSrc: frameImageUrl(row.frameID),
      title: `Frame ${row.frameID}`,
    }))

  const selected = detailKey
    ? frames.find((row) => String(row.frameID) === detailKey)
    : undefined

  const [draft, setDraft] = useState<FrameData>({
    frameGem: 30,
    frameID: 900,
    frameRace: 0,
    frameRole: 0,
    frameType: 1,
  })

  const save = useMutation({
    mutationFn: () => createFrame(draft),
    onSuccess: () => onStatus('Frame saved.'),
    onError: (err: Error) => onStatus(err.message),
  })

  return (
    <div className="space-y-6">
      <p className="text-xs text-fog/80">
        Click a frame to view gem cost and race/role restrictions.
      </p>
      <ContentImageGrid
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        emptyMessage="No frames loaded."
      />
      {selected && (
        <ContentDetailPanel
          title={`Frame ${selected.frameID}`}
          subtitle={`frames.json entry`}
          imageSrc={frameImageUrl(selected.frameID)}
          imageClassName="mx-auto max-h-64 w-64 rounded-lg border border-gold/15 object-contain"
          fields={[
            { label: 'Frame ID', value: String(selected.frameID) },
            { label: 'Gem cost', value: String(selected.frameGem) },
            {
              label: 'Race',
              value: formatRaceId(selected.frameRace),
            },
            {
              label: 'Role',
              value: formatRoleId(selected.frameRole),
            },
            { label: 'Type', value: String(selected.frameType) },
            {
              label: 'Image file',
              value: `frame_${selected.frameID}.webp`,
            },
          ]}
          rawJson={selected}
          onClose={onCloseDetail}
        />
      )}
      <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold-bright">
          Add frame
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label="Frame ID">
            <input
              type="number"
              className={`${inputClass} max-w-xs`}
              value={draft.frameID}
              onChange={(e) =>
                setDraft((d) => ({ ...d, frameID: Number(e.target.value) }))
              }
            />
          </Field>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50"
          >
            Save frame #{draft.frameID}
          </button>
        </div>
      </section>
    </div>
  )
}

function PortraitsPanel({
  data,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
}: {
  data: Array<PortraitData | null>
  search: string
  selectedKey?: string
  onSelect: (key: string) => void
  onCloseDetail: () => void
  detailKey?: string
  onStatus: (msg: string) => void
}) {
  const q = search.toLowerCase()
  const portraits = data.filter((row): row is PortraitData => row !== null)

  const gridItems: ContentGridItem[] = portraits
    .filter((row) => {
      if (!q) return true
      return (
        row.avatarName.toLowerCase().includes(q) ||
        String(row.avatarID).includes(q) ||
        formatRaceId(row.avatarRace).toLowerCase().includes(q) ||
        formatRoleId(row.avatarRole).toLowerCase().includes(q)
      )
    })
    .map((row) => ({
      id: String(row.avatarID),
      imageSrc: portraitImageUrl(row.avatarID),
      title: row.avatarName,
    }))

  const selected = detailKey
    ? portraits.find((row) => String(row.avatarID) === detailKey)
    : undefined

  const [draft, setDraft] = useState<PortraitData>({
    avatarGems: 0,
    avatarGenderID: 2,
    avatarID: 900,
    avatarName: 'New avatar',
    avatarRace: 1,
    avatarRole: 1,
    avatarType: 0,
  })

  const save = useMutation({
    mutationFn: () => createPortrait(draft),
    onSuccess: () => onStatus('Portrait saved.'),
    onError: (err: Error) => onStatus(err.message),
  })

  return (
    <div className="space-y-6">
      <p className="text-xs text-fog/80">
        Click a portrait to view avatar stats and creation defaults.
      </p>
      <ContentImageGrid
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        emptyMessage="No portraits loaded."
      />
      {selected && (
        <ContentDetailPanel
          title={selected.avatarName}
          subtitle={`Avatar ID ${selected.avatarID}`}
          imageSrc={portraitImageUrl(selected.avatarID)}
          imageClassName="mx-auto max-h-72 w-72 rounded-lg border border-gold/15 object-contain"
          fields={[
            { label: 'Avatar ID', value: String(selected.avatarID) },
            { label: 'Name', value: selected.avatarName },
            { label: 'Race', value: formatRaceId(selected.avatarRace) },
            { label: 'Role', value: formatRoleId(selected.avatarRole) },
            { label: 'Gender', value: formatGenderId(selected.avatarGenderID) },
            { label: 'Gem cost', value: String(selected.avatarGems) },
            { label: 'Type', value: String(selected.avatarType) },
            {
              label: 'Image file',
              value: `avatar_${selected.avatarID}.webp`,
            },
          ]}
          rawJson={selected}
          onClose={onCloseDetail}
        />
      )}
      <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
        <h2 className="text-sm uppercase tracking-widest text-gold-bright">
          Add portrait
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Avatar name">
            <input
              className={inputClass}
              value={draft.avatarName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, avatarName: e.target.value }))
              }
            />
          </Field>
          <Field label="Avatar ID">
            <input
              type="number"
              className={inputClass}
              value={draft.avatarID}
              onChange={(e) =>
                setDraft((d) => ({ ...d, avatarID: Number(e.target.value) }))
              }
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="mt-4 rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50"
        >
          Save portrait
        </button>
      </section>
    </div>
  )
}
