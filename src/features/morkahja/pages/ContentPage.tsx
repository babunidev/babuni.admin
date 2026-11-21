import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'
import { activateMorkahjaConnection } from '../../../shared/services/morkahjaConnection'
import { useMorkahjaImageCacheStatus } from '../../../shared/services/morkahjaImageCacheStatus'
import { ContentDetailPanel } from '../components/ContentDetailPanel'
import { ContentEditorPanel } from '../components/ContentEditorPanel'
import { RemoteContentImage } from '../components/RemoteContentImage'
import {
  ContentImageGrid,
  type ContentGridItem,
} from '../components/ContentImageGrid'
import { EncounterDetailPanel } from '../components/EncounterDetailPanel'
import { EncounterEditorPanel } from '../components/EncounterEditorPanel'
import { PageHeader } from '../../../shared/components/PageHeader'
import { SolutionDetailPanel } from '../components/SolutionDetailPanel'
import { Table, type Column } from '../../../shared/components/Table'
import { buildEncounterDetail } from '../utils/encounterDetail'
import {
  createDefaultEncounterDraft,
  formatRewardTypeLabel,
  formatSolutionTypeLabel,
} from '../utils/gameDataReference'
import {
  formatGenderId,
  formatRaceId,
  formatRoleId,
} from '../utils/contentLabels'
import { ImagePickField } from '../components/ImagePickField'
import {
  ImageUploadError,
  RecordSaveError,
  runUploads,
  saveAfterUploads,
  type PendingUpload,
} from '../utils/pendingImages'
import { SaveResultDialog, type SaveResult } from '../components/SaveResultDialog'
import {
  catalogFailureResult,
  catalogSaveResult,
  describeSaveError,
  imageSaveFailureResult,
  withImageResults,
} from '../utils/saveResults'
import {
  encounterImageUrl,
  expansionImageUrl,
  frameImageUrl,
  gameDataBaseUrl,
  portraitImageUrl,
  solutionImageUrl,
  useLocalContent,
} from '../../../config/constants'
import {
  createEncounter,
  type CatalogSaveReport,
  type ImageUploadReport,
  type RemoteImageKind,
  imageBaseFromTitle,
  uploadContentImage,
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
  getContentProfileId,
} from '../services/contentApi'

type ShowResult = (result: SaveResult) => void

/** A chosen image to upload to the live server when the record is saved. */
function liveUpload(kind: RemoteImageKind, name: string, file: File, mode: 'exact' | 'unique' = 'exact'): PendingUpload {
  return { kind, run: () => uploadContentImage(kind, name, file, mode) }
}

import type {
  EncounterData,
  EncounterMap,
  ExpansionData,
  FrameData,
  PortraitData,
  SolutionData,
  SolutionMap,
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

const inputClass =
  'w-full rounded border border-gold/20 bg-ash px-3 py-2 text-sm text-parchment'

export function ContentPage() {
  const { kind: kindParam, itemKey } = useParams<{
    kind?: string
    itemKey?: string
  }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(() =>
    kindParam && tabs.some((entry) => entry.id === kindParam)
      ? (kindParam as Tab)
      : 'encounters',
  )
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const queryClient = useQueryClient()
  const imageCache=useMorkahjaImageCacheStatus()
  const [contentProfileId, setContentProfileId] = useState(() => getContentProfileId() || '')
  const [contentProfileStatus, setContentProfileStatus] = useState('')
  const [connectionReady,setConnectionReady] = useState(false)

  useEffect(() => {
    let mounted = true
    void localConnectionApi<{profiles:{
      id:string;projectId:string;kind:string;displayName:string
    }[]}>().then(result => {
      if (!mounted) return
      const active = activateMorkahjaConnection(result.profiles)
      setContentProfileId(active?.id || '')
      setConnectionReady(true)
      setContentProfileStatus(active ? '' : 'Administrator connection unavailable. Configure it in Connection.')
    }).catch(() => {
      if (mounted) {
        setContentProfileStatus('Connection service unavailable; live content access not verified.')
        setConnectionReady(true)
      }
    })
    return () => {mounted = false}
  }, [])

  const detailKind =
    kindParam && tabs.some((entry) => entry.id === kindParam)
      ? (kindParam as Tab)
      : undefined

  const activeTab = detailKind ?? tab

  const closeDetail = () => navigate('/content')
  const openItem = (contentTab: Tab, key: string) => {
    navigate(`/content/${contentTab}/${encodeURIComponent(key)}`)
  }

  const encountersQuery = useQuery({
    queryKey: ['content', 'encounters', contentProfileId],
    queryFn: fetchEncounters,
    enabled: connectionReady && (
      activeTab === 'encounters' ||
      activeTab === 'solutions' ||
      detailKind === 'encounters' ||
      detailKind === 'solutions'),
  })
  const solutionsQuery = useQuery({
    queryKey: ['content', 'solutions', contentProfileId],
    queryFn: fetchSolutions,
    enabled: connectionReady && (
      activeTab === 'solutions' ||
      activeTab === 'encounters' ||
      detailKind === 'solutions'),
  })
  const expansionsQuery = useQuery({
    queryKey: ['content', 'expansions', contentProfileId],
    queryFn: fetchExpansions,
    enabled: connectionReady && (
      activeTab === 'expansions' ||
      activeTab === 'encounters' ||
      detailKind === 'expansions'),
  })
  const framesQuery = useQuery({
    queryKey: ['content', 'frames', contentProfileId],
    queryFn: fetchFrames,
    enabled: connectionReady && (activeTab === 'frames' || detailKind === 'frames'),
  })
  const portraitsQuery = useQuery({
    queryKey: ['content', 'portraits', contentProfileId],
    queryFn: fetchPortraits,
    enabled: connectionReady && (activeTab === 'portraits' || detailKind === 'portraits'),
  })

  const activeContentLoaded =
    activeTab === 'encounters' ? Boolean(encountersQuery.data) :
    activeTab === 'solutions' ? Boolean(solutionsQuery.data) :
    activeTab === 'expansions' ? Boolean(expansionsQuery.data) :
    activeTab === 'frames' ? Boolean(framesQuery.data) : Boolean(portraitsQuery.data)

  const activeContentError =
    activeTab === 'encounters' ? encountersQuery.error :
    activeTab === 'solutions' ? solutionsQuery.error :
    activeTab === 'expansions' ? expansionsQuery.error :
    activeTab === 'frames' ? framesQuery.error : portraitsQuery.error

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
  }, [encountersQuery.data, search])
  const encounterTotal = Object.keys(encountersQuery.data ?? {}).length

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
        return contentProfileId ? (
          <RemoteContentImage profileId={contentProfileId} kind="encounter"
            name={row.mEncounterImageName} className="h-10 w-16 rounded object-cover"/>
        ) : src ? (
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
  /** Image chosen in the editor; uploaded only when the encounter is saved. */
  const [encounterImage, setEncounterImage] = useState<File | null>(null)

  const openEncounterEditor = (key: string | null, data: EncounterData) => {
    setEncounterEditKey(key)
    setEncounterDraft({ ...data })
    setEncounterImage(null)
    setEncounterEditorOpen(true)
  }

  const closeEncounterEditor = () => {
    setEncounterEditorOpen(false)
    setEncounterEditKey(null)
    setEncounterImage(null)
  }

  const startEncounterEdit = (key: string) => {
    const data = encountersQuery.data?.[key]
    if (!data) return
    openEncounterEditor(key, data)
  }

  const saveEncounter = useMutation({
    mutationFn: async () => {
      const isEdit = Boolean(encounterEditKey)
      const key =
        encounterEditKey ?? String(encounterDraft.mEncounterID).padStart(5, '0')
      let draft = encounterDraft
      let images: ImageUploadReport[] = []
      if (encounterImage) {
        // The image is named after the title; the record then points at it.
        if (contentProfileId) {
          const base = imageBaseFromTitle(draft.mEncounterTitle.trim() || `encounter_${draft.mEncounterID}`)
          images = await runUploads([liveUpload('encounter', base, encounterImage, 'unique')])
          draft = { ...draft, mEncounterImageName: images[0].name.replace(/\.webp$/i, '') }
        } else {
          const file = encounterImage
          let imageName: string | undefined
          await runUploads([{ kind: 'encounter', run: async () => {
            imageName = await uploadEncounterImageFromTitle(
              draft.mEncounterTitle.trim() || `Encounter ${draft.mEncounterID}`, draft.mEncounterID, file)
            return undefined
          } }])
          if (imageName) draft = { ...draft, mEncounterImageName: imageName }
        }
        setEncounterDraft(draft)
        setEncounterImage(null)
      }
      const report = await saveAfterUploads(images, () => createEncounter(key, draft))
      return { isEdit, report, images, title: draft.mEncounterTitle || key }
    },
    onSuccess: ({ isEdit: wasEdit, report, images, title }) => {
      closeEncounterEditor()
      if (images.length) refreshImages()
      if (report) setSaveResult(withImageResults(catalogSaveResult('Encounter', title, wasEdit, report), images))
      else setStatus(
        wasEdit
            ? useLocalContent ? 'Encounter updated in encountersdata.json.' : 'Encounter updated on VPS.'
            : useLocalContent ? 'Encounter saved to encountersdata.json on disk.' : 'Encounter saved on VPS.',
      )
      void queryClient.invalidateQueries({ queryKey: ['content', 'encounters'] })
    },
    onError: (err: Error) => {
      if (err instanceof ImageUploadError) {
        setSaveResult(imageSaveFailureResult('Encounter', encounterDraft.mEncounterTitle, err.kind, err.failure, err.reports))
      } else if (contentProfileId) {
        const uploaded = err instanceof RecordSaveError ? err.reports : []
        if (uploaded.length) refreshImages()
        setSaveResult(catalogFailureResult('Encounter', encounterDraft.mEncounterTitle, err, uploaded))
      } else setStatus(err.message)
    },
  })

  const refreshImages = () => {
    void queryClient.invalidateQueries({ queryKey: ['content'] })
  }

  // Only said when content is not coming from the live game.
  const dataSourceHint = contentProfileId
    ? null
    : useLocalContent
    ? `Local files: MorkahjaWebApp/server/game (data) + client/public (images, UI); saves go to disk`
    : gameDataBaseUrl
      ? `Loading from ${gameDataBaseUrl}`
      : 'No content source configured'

  return (
    <div>
      <PageHeader title="Content" />
      {contentProfileStatus && <p className="mb-3 text-xs text-fog" role="status">
        {contentProfileStatus}
      </p>}
      {connectionReady && dataSourceHint && <p className="mb-4 text-xs text-fog">{dataSourceHint}</p>}
      {contentProfileId && <p className="mb-3 text-xs text-fog" role="status">
        {activeContentError ? 'Last remote catalog read failed; no fallback content used.'
          : activeContentLoaded ? 'Last remote catalog read succeeded; SSH session closed.'
            : 'Awaiting approved remote catalog read.'}
      </p>}
      {contentProfileId && <p className="mb-3 text-xs text-fog" role="status">
        {imageCache.phase==='syncing'
          ? `Images: syncing the whole workspace · ${imageCache.verified} checked, ${imageCache.downloaded} updated · existing local files remain available.`
          : imageCache.phase==='ready'
            ? `Images: ${imageCache.cached} stored on this computer · updated files are refreshed automatically.`
            : imageCache.phase==='failed'
              ? `Image sync unavailable (${imageCache.error || 'unknown error'}); locally cached images remain available.`
              : 'Images: preparing persistent local cache.'}
      </p>}
      {activeContentError && (
        <p role="alert" className="mb-4 rounded border border-ember/40 bg-ember/10 p-3 text-sm text-red-300">
          Content could not be loaded from the configured source. No fallback data is shown.
          {' · '}{activeContentError instanceof Error ? activeContentError.message : 'CONTENT_READ_FAILED'}
        </p>
      )}

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
              activeTab === item.id
                ? 'border-gold/40 bg-gold/15 text-gold-bright'
                : 'border-gold/15 text-fog hover:text-parchment'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'encounters' ? (
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
            activeTab === 'frames' || activeTab === 'portraits'
              ? 'Search by id, name, race, or role…'
              : 'Search by id, key, or title…'
          }
          className={`${inputClass} mb-4 max-w-md`}
        />
      )}

      {activeTab === 'encounters' && (
        <div className="space-y-8">
          <p className="text-xs text-fog/80">
            Click a row for details, Edit (or double-click) to change text, image, and
            fields. Use Add encounter for new content.
            {encounterTotal > 0 &&
              (search
                ? ` ${encounterRows.length} of ${encounterTotal} encounters match.`
                : ` All ${encounterTotal} encounters are listed.`)}
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
              profileId={contentProfileId || undefined}
              saveError={
                saveEncounter.error instanceof Error
                  ? describeSaveError(saveEncounter.error.message)
                  : null
              }
              pendingImage={encounterImage}
              onPickImage={contentProfileId || useLocalContent ? setEncounterImage : undefined}
            />
          )}
          {detailKind === 'encounters' &&
            itemKey &&
            selectedEncounterDetail &&
            !encounterEditorOpen && (
            <EncounterDetailPanel
              profileId={contentProfileId}
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

      {activeTab === 'solutions' && (
        <SolutionsPanel
          profileId={contentProfileId}
          data={solutionsQuery.data ?? {}}
          encounters={encountersQuery.data ?? {}}
          isLoading={solutionsQuery.isLoading}
          search={search}
          selectedKey={detailKind === 'solutions' ? itemKey : undefined}
          onSelect={(key) => openItem('solutions', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'solutions' ? itemKey : undefined}
          onStatus={setStatus}
          onResult={setSaveResult}
        />
      )}

      {activeTab === 'expansions' && (
        <ExpansionPanel
          profileId={contentProfileId}
          data={expansionsQuery.data?.expansions ?? {}}
          search={search}
          selectedKey={detailKind === 'expansions' ? itemKey : undefined}
          onSelect={(key) => openItem('expansions', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'expansions' ? itemKey : undefined}
          onStatus={setStatus}
          onResult={setSaveResult}
        />
      )}

      {activeTab === 'frames' && (
        <FramesPanel
          profileId={contentProfileId}
          data={framesQuery.data?.Frames ?? []}
          search={search}
          selectedKey={detailKind === 'frames' ? itemKey : undefined}
          onSelect={(key) => openItem('frames', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'frames' ? itemKey : undefined}
          onStatus={setStatus}
          onResult={setSaveResult}
        />
      )}

      {activeTab === 'portraits' && (
        <PortraitsPanel
          profileId={contentProfileId}
          data={portraitsQuery.data?.Avatar ?? []}
          search={search}
          selectedKey={detailKind === 'portraits' ? itemKey : undefined}
          onSelect={(key) => openItem('portraits', key)}
          onCloseDetail={closeDetail}
          detailKey={detailKind === 'portraits' ? itemKey : undefined}
          onStatus={setStatus}
          onResult={setSaveResult}
        />
      )}

      {status && (
        <p className="mt-6 rounded border border-gold/20 bg-ash/60 px-4 py-3 text-sm text-parchment">
          {status}
        </p>
      )}
      <SaveResultDialog result={saveResult} onClose={() => setSaveResult(null)} />
    </div>
  )
}

/** Save handling shared by the solution, expansion, frame and portrait editors. */
function usePanelSave<T>({
  kind,
  queryName,
  profileId,
  onStatus,
  onResult,
  onSaved,
  save,
  nameOf,
  exists,
  uploads,
}: {
  kind: 'Solution' | 'Expansion' | 'Frame' | 'Portrait'
  queryName: string
  profileId?: string
  onStatus: (msg: string) => void
  onResult: ShowResult
  /** Runs after a successful save, e.g. to close the editor. */
  onSaved?: () => void
  save: (draft: T) => Promise<CatalogSaveReport | undefined>
  nameOf: (draft: T) => string
  exists: (draft: T) => boolean
  /** The images chosen in the editor, uploaded first when Save is pressed. */
  uploads?: (draft: T, images: PendingImages) => PendingUpload[]
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ draft, images }: { draft: T; images: PendingImages }) => {
      const wasEdit = exists(draft)
      const uploaded = await runUploads(uploads?.(draft, images) ?? [])
      return { draft, wasEdit, uploaded, report: await saveAfterUploads(uploaded, () => save(draft)) }
    },
    onSuccess: ({ draft, wasEdit, uploaded, report }) => {
      onSaved?.()
      if (report) onResult(withImageResults(catalogSaveResult(kind, nameOf(draft), wasEdit, report), uploaded))
      else onStatus(`${kind} saved.`)
      void queryClient.invalidateQueries({ queryKey: uploaded.length ? ['content'] : ['content', queryName] })
    },
    onError: (err: Error, { draft }) => {
      if (err instanceof ImageUploadError) {
        if (profileId) onResult(imageSaveFailureResult(kind, nameOf(draft), err.kind, err.failure, err.reports))
        else onStatus(describeSaveError(err.message))
      } else if (profileId) {
        const uploaded = err instanceof RecordSaveError ? err.reports : []
        if (uploaded.length) void queryClient.invalidateQueries({ queryKey: ['content'] })
        onResult(catalogFailureResult(kind, nameOf(draft), err, uploaded))
      } else onStatus(err.message)
    },
  })
}

/** Which item the side editor is working on; `null` while it is closed. */
/** Images chosen in an editor, by field, waiting for Save. */
type PendingImages = Record<string, File>
type EditorState<T> = { mode: 'add' | 'edit'; draft: T; images: PendingImages } | null

function useEditorState<T>() {
  const [editor, setEditor] = useState<EditorState<T>>(null)
  return {
    editor,
    openAdd: (draft: T) => setEditor({ mode: 'add', draft, images: {} }),
    openEdit: (draft: T) => setEditor({ mode: 'edit', draft: { ...draft }, images: {} }),
    close: () => setEditor(null),
    patch: (next: Partial<T>) =>
      setEditor((current) => current && { ...current, draft: { ...current.draft, ...next } }),
    /** Choose (or with `null` drop) the image for one field; nothing is uploaded yet. */
    pickImage: (field: string, file: File | null) =>
      setEditor((current) => {
        if (!current) return current
        const images = { ...current.images }
        if (file) images[field] = file
        else delete images[field]
        return { ...current, images }
      }),
  }
}

function NumberField({
  label,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
  disabled?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        className={`${inputClass} disabled:opacity-60`}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <Field label={label}>
      <textarea
        className={inputClass}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/** Hint line above a grid with the tab's "Add …" button on the right. */
function PanelIntro({
  hint,
  addLabel,
  onAdd,
}: {
  hint: string
  addLabel: string
  onAdd: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-fog/80">{hint}</p>
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright transition hover:bg-gold/25"
      >
        {addLabel}
      </button>
    </div>
  )
}

const idHint = (mode: 'add' | 'edit') =>
  mode === 'edit' ? 'Fixed while editing — the entry keeps its ID.' : undefined

/** Warns when a new entry's ID already belongs to an existing one. */
function replaceWarning(mode: 'add' | 'edit', existingName: string | undefined, id: number) {
  return mode === 'add' && existingName !== undefined
    ? `ID ${id} already belongs to “${existingName}”. Saving replaces it.`
    : null
}

function editorSubtitle(mode: 'add' | 'edit', fileName: string, key: string | number) {
  return (
    <>
      {mode === 'edit' ? 'Updates' : 'Saves as'} key{' '}
      <span className="font-mono text-parchment">{key}</span> in {fileName}
    </>
  )
}

const errorText = (error: unknown) =>
  error instanceof Error ? describeSaveError(error.message) : null

interface PanelProps<Row> {
  profileId?: string
  data: Row
  search: string
  selectedKey?: string
  onSelect: (key: string) => void
  onCloseDetail: () => void
  detailKey?: string
  onStatus: (msg: string) => void
  onResult: ShowResult
}

const newSolution = (): SolutionData => ({
  mSolutionID: 90001,
  mSolutionIconName: 'skill_learn',
  mSolutionInventoryType: 1,
  mSolutionName: 'New solution',
  mSolutionRewardType: 1,
  mSolutionText: '',
  mSolutionType: 1,
  mSolutionUses: 1,
})

function SolutionsPanel({
  profileId,
  data,
  encounters,
  isLoading,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
  onResult,
}: PanelProps<SolutionMap> & { encounters: EncounterMap; isLoading: boolean }) {
  const q = search.toLowerCase()
  const gridItems: ContentGridItem[] = Object.entries(data)
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
      remoteKind: 'solution',
      remoteName: row.mSolutionIconName,
      title: row.mSolutionName,
    }))

  const selected = detailKey ? data[detailKey] : undefined
  const { editor, openAdd, openEdit, close, patch, pickImage } = useEditorState<SolutionData>()

  const save = usePanelSave<SolutionData>({
    kind: 'Solution',
    queryName: 'solutions',
    profileId,
    onStatus,
    onResult,
    onSaved: close,
    save: (d) => createSolution(String(d.mSolutionID), d),
    nameOf: (d) => d.mSolutionName,
    exists: (d) => Object.hasOwn(data, String(d.mSolutionID)),
    uploads: (d, images) => {
      const file = images.icon
      if (!file) return []
      return profileId
        ? [liveUpload('solution', d.mSolutionIconName, file)]
        : [{ kind: 'solution', run: async () => { await uploadSolutionImage(d.mSolutionIconName, file); return undefined } }]
    },
  })

  const draft = editor?.draft
  return (
    <div className="space-y-6">
      <PanelIntro
        hint="Click an icon to view its description and linked encounters, then Edit to change it."
        addLabel="Add solution"
        onAdd={() => {
          if (detailKey) onCloseDetail()
          save.reset()
          openAdd(newSolution())
        }}
      />
      <ContentImageGrid
        profileId={profileId}
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        emptyMessage="No solutions loaded."
      />
      {selected && detailKey && !editor && (
        <SolutionDetailPanel
          profileId={profileId}
          keyId={detailKey}
          solution={selected}
          encounters={encounters}
          onClose={onCloseDetail}
          onEdit={() => {
            save.reset()
            openEdit(selected)
          }}
        />
      )}
      {detailKey && !selected && !isLoading && (
        <p className="text-sm text-red-300/90">Solution &quot;{detailKey}&quot; not found.</p>
      )}
      {editor && draft && (
        <ContentEditorPanel
          title={editor.mode === 'edit' ? 'Edit solution' : 'Add solution'}
          subtitle={editorSubtitle(editor.mode, 'solutiondata.json', draft.mSolutionID)}
          saveLabel={editor.mode === 'edit' ? 'Save changes' : 'Save solution'}
          isSaving={save.isPending}
          saveError={errorText(save.error)}
          warning={replaceWarning(editor.mode, data[String(draft.mSolutionID)]?.mSolutionName, draft.mSolutionID)}
          onSave={() => save.mutate(editor)}
          onClose={close}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="ID"
              hint={idHint(editor.mode)}
              disabled={editor.mode === 'edit'}
              value={draft.mSolutionID}
              onChange={(v) => patch({ mSolutionID: v })}
            />
            <TextField label="Name" value={draft.mSolutionName} onChange={(v) => patch({ mSolutionName: v })} />
            <NumberField
              label={`Type (${formatSolutionTypeLabel(draft.mSolutionType)})`}
              value={draft.mSolutionType}
              onChange={(v) => patch({ mSolutionType: v })}
            />
            <NumberField label="Uses" value={draft.mSolutionUses} onChange={(v) => patch({ mSolutionUses: v })} />
            <NumberField
              label="Inventory type"
              value={draft.mSolutionInventoryType}
              onChange={(v) => patch({ mSolutionInventoryType: v })}
            />
            <NumberField
              label={`Reward type (${formatRewardTypeLabel(draft.mSolutionRewardType)})`}
              value={draft.mSolutionRewardType}
              onChange={(v) => patch({ mSolutionRewardType: v })}
            />
          </div>
          <TextAreaField label="Text" value={draft.mSolutionText} onChange={(v) => patch({ mSolutionText: v })} />
          <TextField
            label="Icon name"
            value={draft.mSolutionIconName}
            onChange={(v) => patch({ mSolutionIconName: v })}
          />
          {profileId && draft.mSolutionIconName && (
            <RemoteContentImage
              profileId={profileId}
              kind="solution"
              name={draft.mSolutionIconName}
              className="h-24 w-24 rounded-lg border border-gold/15 object-cover"
            />
          )}
          {(profileId || useLocalContent) && (
            <ImagePickField
              label="New solution icon"
              file={editor.images.icon ?? null}
              onChange={(file) => pickImage('icon', file)}
            />
          )}
          <p className="text-xs text-fog">
            {profileId
              ? 'Save writes the solution and any new icon to the live game, MorkahjaWebApp and GitHub.'
              : 'Saves to solutiondata.json and solutionimages/ on disk.'}
          </p>
        </ContentEditorPanel>
      )}
    </div>
  )
}

const newExpansion = (): ExpansionData => ({
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

const expansionImageFields = ['mExtensioCollectionImage', 'mExtensioHeaderImage', 'mExtensioUnlockButton'] as const
type ExpansionImageField = (typeof expansionImageFields)[number]

function ExpansionPanel({
  profileId,
  data,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
  onResult,
}: PanelProps<Record<string, ExpansionData>>) {
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
    remoteKind: 'expansion',
    remoteName: row.mExtensioCollectionImage,
    title: row.mExtensioName,
  }))

  const selected = detailKey ? data[detailKey] : undefined
  const { editor, openAdd, openEdit, close, patch, pickImage } = useEditorState<ExpansionData>()

  const save = usePanelSave<ExpansionData>({
    kind: 'Expansion',
    queryName: 'expansions',
    profileId,
    onStatus,
    onResult,
    onSaved: close,
    save: (d) => createExpansion(String(d.mExtensioID), d),
    nameOf: (d) => d.mExtensioName,
    exists: (d) => Object.hasOwn(data, String(d.mExtensioID)),
    uploads: (d, images) => expansionImageFields
      .filter((field) => images[field])
      .map((field) => liveUpload('expansion', d[field], images[field])),
  })

  const draft = editor?.draft
  const imageField = (
    current: ExpansionData,
    label: string,
    field: ExpansionImageField,
  ) => (
    <div className="space-y-2 rounded-lg border border-gold/10 bg-void/30 p-3">
      <TextField label={`${label} (no .webp)`} value={current[field]} onChange={(v) => patch({ [field]: v })} />
      {profileId && current[field] && (
        <RemoteContentImage
          profileId={profileId}
          kind="expansion"
          name={current[field]}
          className="max-h-32 w-full rounded border border-gold/15 object-contain"
        />
      )}
      {profileId && (
        <ImagePickField
          label={`New ${label.toLowerCase()}`}
          file={editor?.images[field] ?? null}
          onChange={(file) => pickImage(field, file)}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PanelIntro
        hint="Click an image to view expansion text, costs and assets, then Edit to change it."
        addLabel="Add expansion"
        onAdd={() => {
          if (detailKey) onCloseDetail()
          save.reset()
          openAdd(newExpansion())
        }}
      />
      <ContentImageGrid
        profileId={profileId}
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        columns="wide"
        emptyMessage="No expansions loaded."
      />
      {selected && detailKey && !editor && (
        <ContentDetailPanel
          title={selected.mExtensioName}
          subtitle={`Key ${detailKey} · ID ${selected.mExtensioID}`}
          imageSrc={expansionImageUrl(selected.mExtensioHeaderImage)}
          remoteImage={profileId ? {profileId,kind:'expansion',name:selected.mExtensioHeaderImage} : undefined}
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
          onEdit={() => {
            save.reset()
            openEdit(selected)
          }}
        />
      )}
      {editor && draft && (
        <ContentEditorPanel
          title={editor.mode === 'edit' ? 'Edit expansion' : 'Add expansion'}
          subtitle={editorSubtitle(editor.mode, 'expansiondata.json', draft.mExtensioID)}
          saveLabel={editor.mode === 'edit' ? 'Save changes' : 'Save expansion'}
          isSaving={save.isPending}
          saveError={errorText(save.error)}
          warning={replaceWarning(editor.mode, data[String(draft.mExtensioID)]?.mExtensioName, draft.mExtensioID)}
          onSave={() => save.mutate(editor)}
          onClose={close}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" value={draft.mExtensioName} onChange={(v) => patch({ mExtensioName: v })} />
            <NumberField
              label="ID"
              hint={idHint(editor.mode)}
              disabled={editor.mode === 'edit'}
              value={draft.mExtensioID}
              onChange={(v) => patch({ mExtensioID: v })}
            />
            <NumberField label="Gem cost" value={draft.mExtensioCost} onChange={(v) => patch({ mExtensioCost: v })} />
            <NumberField label="Reward ID" value={draft.mExtensioReward} onChange={(v) => patch({ mExtensioReward: v })} />
          </div>
          <TextField label="Summary" value={draft.mExtensioSummaryText} onChange={(v) => patch({ mExtensioSummaryText: v })} />
          <label className="flex items-center gap-2 text-sm text-fog">
            <input
              type="checkbox"
              checked={draft.mExtensioActive}
              onChange={(e) => patch({ mExtensioActive: e.target.checked })}
            />
            Active in shop
          </label>
          <TextAreaField label="Description" rows={6} value={draft.mExtensioText} onChange={(v) => patch({ mExtensioText: v })} />
          {imageField(draft, 'Collection image', 'mExtensioCollectionImage')}
          {imageField(draft, 'Header image', 'mExtensioHeaderImage')}
          {imageField(draft, 'Unlock button', 'mExtensioUnlockButton')}
        </ContentEditorPanel>
      )}
    </div>
  )
}

const newFrame = (): FrameData => ({
  frameGem: 30,
  frameID: 900,
  frameRace: 0,
  frameRole: 0,
  frameType: 1,
})

function FramesPanel({
  profileId,
  data,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
  onResult,
}: PanelProps<Array<FrameData | null>>) {
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
      remoteKind: 'frame',
      remoteName: `frame_${row.frameID}`,
      title: `Frame ${row.frameID}`,
    }))

  const selected = detailKey
    ? frames.find((row) => String(row.frameID) === detailKey)
    : undefined
  const { editor, openAdd, openEdit, close, patch, pickImage } = useEditorState<FrameData>()

  const save = usePanelSave<FrameData>({
    kind: 'Frame',
    queryName: 'frames',
    profileId,
    onStatus,
    onResult,
    onSaved: close,
    save: (d) => createFrame(d),
    nameOf: (d) => `#${d.frameID}`,
    exists: (d) => Boolean(data[d.frameID]),
    uploads: (d, images) => (images.image ? [liveUpload('frame', `frame_${d.frameID}`, images.image)] : []),
  })

  const draft = editor?.draft
  return (
    <div className="space-y-6">
      <PanelIntro
        hint="Click a frame to view gem cost and race/role restrictions, then Edit to change it."
        addLabel="Add frame"
        onAdd={() => {
          if (detailKey) onCloseDetail()
          save.reset()
          openAdd(newFrame())
        }}
      />
      <ContentImageGrid
        profileId={profileId}
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        emptyMessage="No frames loaded."
      />
      {selected && !editor && (
        <ContentDetailPanel
          title={`Frame ${selected.frameID}`}
          subtitle={`frames.json entry`}
          imageSrc={frameImageUrl(selected.frameID)}
          remoteImage={profileId ? {profileId,kind:'frame',name:`frame_${selected.frameID}`} : undefined}
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
          onEdit={() => {
            save.reset()
            openEdit(selected)
          }}
        />
      )}
      {editor && draft && (
        <ContentEditorPanel
          title={editor.mode === 'edit' ? 'Edit frame' : 'Add frame'}
          subtitle={editorSubtitle(editor.mode, 'frames.json', draft.frameID)}
          saveLabel={editor.mode === 'edit' ? 'Save changes' : `Save frame #${draft.frameID}`}
          isSaving={save.isPending}
          saveError={errorText(save.error)}
          warning={replaceWarning(editor.mode, data[draft.frameID] ? `Frame ${draft.frameID}` : undefined, draft.frameID)}
          onSave={() => save.mutate(editor)}
          onClose={close}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Frame ID"
              hint={idHint(editor.mode)}
              disabled={editor.mode === 'edit'}
              value={draft.frameID}
              onChange={(v) => patch({ frameID: v })}
            />
            <NumberField label="Gem cost" value={draft.frameGem} onChange={(v) => patch({ frameGem: v })} />
            <NumberField label="Type" value={draft.frameType} onChange={(v) => patch({ frameType: v })} />
            <NumberField label={`Race (${formatRaceId(draft.frameRace)})`} value={draft.frameRace} onChange={(v) => patch({ frameRace: v })} />
            <NumberField label={`Role (${formatRoleId(draft.frameRole)})`} value={draft.frameRole} onChange={(v) => patch({ frameRole: v })} />
          </div>
          {profileId && (
            <>
              <RemoteContentImage
                profileId={profileId}
                kind="frame"
                name={`frame_${draft.frameID}`}
                className="h-32 w-32 rounded-lg border border-gold/15 object-contain"
              />
              <ImagePickField
                label={`New frame_${draft.frameID}.webp`}
                file={editor.images.image ?? null}
                onChange={(file) => pickImage('image', file)}
              />
            </>
          )}
          <p className="text-xs text-fog">The picture is always frame_&lt;ID&gt;.webp.</p>
        </ContentEditorPanel>
      )}
    </div>
  )
}

const newPortrait = (): PortraitData => ({
  avatarGems: 0,
  avatarGenderID: 2,
  avatarID: 900,
  avatarName: 'New avatar',
  avatarRace: 1,
  avatarRole: 1,
  avatarType: 0,
})

function PortraitsPanel({
  profileId,
  data,
  search,
  selectedKey,
  onSelect,
  onCloseDetail,
  detailKey,
  onStatus,
  onResult,
}: PanelProps<Array<PortraitData | null>>) {
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
      remoteKind: 'portrait',
      remoteName: `avatar_${row.avatarID}`,
      title: row.avatarName,
    }))

  const selected = detailKey
    ? portraits.find((row) => String(row.avatarID) === detailKey)
    : undefined
  const { editor, openAdd, openEdit, close, patch, pickImage } = useEditorState<PortraitData>()

  const save = usePanelSave<PortraitData>({
    kind: 'Portrait',
    queryName: 'portraits',
    profileId,
    onStatus,
    onResult,
    onSaved: close,
    save: (d) => createPortrait(d),
    nameOf: (d) => d.avatarName,
    exists: (d) => Boolean(data[d.avatarID]),
    uploads: (d, images) => (images.image ? [liveUpload('portrait', `avatar_${d.avatarID}`, images.image)] : []),
  })

  const draft = editor?.draft
  return (
    <div className="space-y-6">
      <PanelIntro
        hint="Click a portrait to view avatar stats and creation defaults, then Edit to change it."
        addLabel="Add portrait"
        onAdd={() => {
          if (detailKey) onCloseDetail()
          save.reset()
          openAdd(newPortrait())
        }}
      />
      <ContentImageGrid
        profileId={profileId}
        items={gridItems}
        selectedId={selectedKey}
        onSelect={onSelect}
        emptyMessage="No portraits loaded."
      />
      {selected && !editor && (
        <ContentDetailPanel
          title={selected.avatarName}
          subtitle={`Avatar ID ${selected.avatarID}`}
          imageSrc={portraitImageUrl(selected.avatarID)}
          remoteImage={profileId ? {profileId,kind:'portrait',name:`avatar_${selected.avatarID}`} : undefined}
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
          onEdit={() => {
            save.reset()
            openEdit(selected)
          }}
        />
      )}
      {editor && draft && (
        <ContentEditorPanel
          title={editor.mode === 'edit' ? 'Edit portrait' : 'Add portrait'}
          subtitle={editorSubtitle(editor.mode, 'portraits.json', draft.avatarID)}
          saveLabel={editor.mode === 'edit' ? 'Save changes' : 'Save portrait'}
          isSaving={save.isPending}
          saveError={errorText(save.error)}
          warning={replaceWarning(editor.mode, data[draft.avatarID]?.avatarName, draft.avatarID)}
          onSave={() => save.mutate(editor)}
          onClose={close}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Avatar name" value={draft.avatarName} onChange={(v) => patch({ avatarName: v })} />
            <NumberField
              label="Avatar ID"
              hint={idHint(editor.mode)}
              disabled={editor.mode === 'edit'}
              value={draft.avatarID}
              onChange={(v) => patch({ avatarID: v })}
            />
            <NumberField label="Gem cost" value={draft.avatarGems} onChange={(v) => patch({ avatarGems: v })} />
            <NumberField label="Type" value={draft.avatarType} onChange={(v) => patch({ avatarType: v })} />
            <NumberField label={`Race (${formatRaceId(draft.avatarRace)})`} value={draft.avatarRace} onChange={(v) => patch({ avatarRace: v })} />
            <NumberField label={`Role (${formatRoleId(draft.avatarRole)})`} value={draft.avatarRole} onChange={(v) => patch({ avatarRole: v })} />
            <NumberField label={`Gender (${formatGenderId(draft.avatarGenderID)})`} value={draft.avatarGenderID} onChange={(v) => patch({ avatarGenderID: v })} />
          </div>
          {profileId && (
            <>
              <RemoteContentImage
                profileId={profileId}
                kind="portrait"
                name={`avatar_${draft.avatarID}`}
                className="h-40 w-40 rounded-lg border border-gold/15 object-contain"
              />
              <ImagePickField
                label={`New avatar_${draft.avatarID}.webp`}
                file={editor.images.image ?? null}
                onChange={(file) => pickImage('image', file)}
              />
            </>
          )}
          <p className="text-xs text-fog">The picture is always avatar_&lt;ID&gt;.webp.</p>
        </ContentEditorPanel>
      )}
    </div>
  )
}
