import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'
import { activateMorkahjaConnection } from '../../../shared/services/morkahjaConnection'
import { useMorkahjaImageCacheStatus } from '../../../shared/services/morkahjaImageCacheStatus'
import { ContentDetailPanel } from '../components/ContentDetailPanel'
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
import { createDefaultEncounterDraft } from '../utils/gameDataReference'
import {
  formatGenderId,
  formatRaceId,
  formatRoleId,
} from '../utils/contentLabels'
import { ImageUploadField } from '../components/ImageUploadField'
import { SaveResultDialog, type SaveResult } from '../components/SaveResultDialog'
import {
  catalogFailureResult,
  catalogSaveResult,
  describeSaveError,
  imageFailureResult,
  imageUploadResult,
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

/** An upload handler that writes to the live server and shows the result popup. */
function liveImageUploader(
  show: ShowResult,
  onUploaded: () => void,
  kind: RemoteImageKind,
  name: string,
  mode: 'exact' | 'unique',
  notes: string[] = [],
) {
  return async (file: File): Promise<string> => {
    try {
      const report = await uploadContentImage(kind, name, file, mode)
      show(imageUploadResult(report, notes))
      onUploaded()
      return report.name.replace(/\.webp$/i, '')
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('IMAGE_WRITE_FAILED')
      show(imageFailureResult(kind, failure))
      throw new Error(describeSaveError(failure.message), { cause: error })
    }
  }
}

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
  const [contentProfileStatus, setContentProfileStatus] = useState('Checking Morkahja administrator connection…')
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
      setContentProfileStatus(active
        ? 'Using your administrator connection. Saves go to the live game and are committed to GitHub.'
        : 'Administrator connection unavailable. Configure it in Connection.')
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
        remoteKind: 'solution',
        remoteName: row.mSolutionIconName,
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
      const report = await createEncounter(key, encounterDraft)
      return { isEdit, report, title: encounterDraft.mEncounterTitle || key }
    },
    onSuccess: ({ isEdit: wasEdit, report, title }) => {
      closeEncounterEditor()
      if (report) setSaveResult(catalogSaveResult('Encounter', title, wasEdit, report))
      else setStatus(
        wasEdit
            ? useLocalContent ? 'Encounter updated in encountersdata.json.' : 'Encounter updated on VPS.'
            : useLocalContent ? 'Encounter saved to encountersdata.json on disk.' : 'Encounter saved on VPS.',
      )
      void queryClient.invalidateQueries({ queryKey: ['content', 'encounters'] })
    },
    onError: (err: Error) => {
      if (contentProfileId) {
        setSaveResult(catalogFailureResult('Encounter', encounterDraft.mEncounterTitle, err))
      } else setStatus(err.message)
    },
  })

  const saveSolution = useMutation({
    mutationFn: async () => {
      const key = String(solutionDraft.mSolutionID)
      const wasEdit = Boolean(solutionsQuery.data?.[key])
      const report = await createSolution(key, solutionDraft)
      return { report, wasEdit }
    },
    onSuccess: ({ report, wasEdit }) => {
      if (report) {
        setSaveResult(catalogSaveResult('Solution', solutionDraft.mSolutionName, wasEdit, report))
      } else setStatus(useLocalContent
        ? 'Solution saved to solutiondata.json on disk.'
        : 'Solution saved on VPS.')
      void queryClient.invalidateQueries({ queryKey: ['content', 'solutions'] })
    },
    onError: (err: Error) => {
      if (contentProfileId) {
        setSaveResult(catalogFailureResult('Solution', solutionDraft.mSolutionName, err))
      } else setStatus(err.message)
    },
  })
  const refreshImages = () => {
    void queryClient.invalidateQueries({ queryKey: ['content'] })
  }

  const dataSourceHint = contentProfileId
    ? 'Live game catalog and images via your administrator connection · saves are committed to GitHub'
    : useLocalContent
    ? `Local files: MorkahjaWebApp/server/game (data) + client/public (images, UI); saves go to disk`
    : gameDataBaseUrl
      ? `Loading from ${gameDataBaseUrl}`
      : 'No content source configured'

  return (
    <div>
      <PageHeader
        title="Content"
        description="Browse and add encounters, solutions, expansions, frames, and portraits."
      />
      <p className="mb-3 text-xs text-fog" role="status">
        {contentProfileStatus}
      </p>
      <p className="mb-4 text-xs text-fog">{dataSourceHint}</p>
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
              onUploadImage={
                contentProfileId
                  ? (file) =>
                      liveImageUploader(
                        setSaveResult,
                        refreshImages,
                        'encounter',
                        imageBaseFromTitle(
                          encounterDraft.mEncounterTitle.trim() ||
                            `encounter_${encounterDraft.mEncounterID}`,
                        ),
                        'unique',
                        ['The editor now points at this image. Click Save encounter so the game uses it.'],
                      )(file)
                  : useLocalContent
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
        <div className="space-y-8">
          <p className="text-xs text-fog/80">
            Click an icon to view full description and linked encounters.
          </p>
          <ContentImageGrid
            profileId={contentProfileId}
            items={solutionGridItems}
            selectedId={detailKind === 'solutions' ? itemKey : undefined}
            onSelect={(key) => openItem('solutions', key)}
            emptyMessage="No solutions loaded."
          />
          {detailKind === 'solutions' && selectedSolution && (
            <SolutionDetailPanel
              profileId={contentProfileId}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm uppercase tracking-widest text-gold-bright">
                Add or edit solution
              </h2>
              {selectedSolution && (
                <button
                  type="button"
                  onClick={() => setSolutionDraft({ ...selectedSolution.solution })}
                  className="rounded border border-gold/25 px-3 py-1 text-xs text-gold-bright hover:bg-gold/15"
                >
                  Edit “{selectedSolution.solution.mSolutionName}”
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-fog">
              {contentProfileId
                ? 'Saving with an existing ID replaces that solution in the live game. The icon goes to solutionimages/ on the server.'
                : 'Saves to solutiondata.json and solutionimages/ on disk.'}
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
              {contentProfileId ? (
                <ImageUploadField
                  label="Upload solution icon (saved under the icon name)"
                  fileName={solutionDraft.mSolutionIconName}
                  onUpload={liveImageUploader(
                    setSaveResult,
                    refreshImages,
                    'solution',
                    solutionDraft.mSolutionIconName,
                    'exact',
                  )}
                />
              ) : useLocalContent && (
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

/** Save handling shared by the expansion, frame and portrait editors. */
function usePanelSave<T>({
  kind,
  queryName,
  profileId,
  onStatus,
  onResult,
  save,
  nameOf,
  exists,
}: {
  kind: 'Expansion' | 'Frame' | 'Portrait'
  queryName: string
  profileId?: string
  onStatus: (msg: string) => void
  onResult: ShowResult
  save: (draft: T) => Promise<CatalogSaveReport | undefined>
  nameOf: (draft: T) => string
  exists: (draft: T) => boolean
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (draft: T) => ({ draft, wasEdit: exists(draft), report: await save(draft) }),
    onSuccess: ({ draft, wasEdit, report }) => {
      if (report) onResult(catalogSaveResult(kind, nameOf(draft), wasEdit, report))
      else onStatus(`${kind} saved.`)
      void queryClient.invalidateQueries({ queryKey: ['content', queryName] })
    },
    onError: (err: Error, draft) => {
      if (profileId) onResult(catalogFailureResult(kind, nameOf(draft), err))
      else onStatus(err.message)
    },
  })
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputClass}
        value={Number.isFinite(value) ? value : 0}
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

function EditorHeader({
  title,
  loadLabel,
  onLoad,
  hint,
}: {
  title: string
  loadLabel?: string
  onLoad?: () => void
  hint: string
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm uppercase tracking-widest text-gold-bright">{title}</h2>
        {onLoad && loadLabel && (
          <button
            type="button"
            onClick={onLoad}
            className="rounded border border-gold/25 px-3 py-1 text-xs text-gold-bright hover:bg-gold/15"
          >
            Edit “{loadLabel}”
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-fog">{hint}</p>
    </>
  )
}

const saveButtonClass =
  'mt-4 rounded border border-gold/30 bg-gold/15 px-4 py-2 text-sm text-gold-bright disabled:opacity-50'

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

function useImageRefresh() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: ['content'] })
}

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
  const patch = (next: Partial<ExpansionData>) => setDraft((d) => ({ ...d, ...next }))
  const refreshImages = useImageRefresh()

  const save = usePanelSave<ExpansionData>({
    kind: 'Expansion',
    queryName: 'expansions',
    profileId,
    onStatus,
    onResult,
    save: (d) => createExpansion(String(d.mExtensioID), d),
    nameOf: (d) => d.mExtensioName,
    exists: (d) => Object.hasOwn(data, String(d.mExtensioID)),
  })

  const imageField = (label: string, field: 'mExtensioCollectionImage' | 'mExtensioHeaderImage' | 'mExtensioUnlockButton') => (
    <div className="space-y-2">
      <TextField label={`${label} (no .webp)`} value={draft[field]} onChange={(v) => patch({ [field]: v })} />
      {profileId && (
        <ImageUploadField
          label={`Upload ${label.toLowerCase()}`}
          fileName={draft[field]}
          onUpload={liveImageUploader(onResult, refreshImages, 'expansion', draft[field], 'exact')}
        />
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <p className="text-xs text-fog/80">
        Click an image to view expansion text, costs, and assets.
      </p>
      <ContentImageGrid
        profileId={profileId}
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
        />
      )}
      <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
        <EditorHeader
          title="Add or edit expansion"
          loadLabel={selected?.mExtensioName}
          onLoad={selected ? () => setDraft({ ...selected }) : undefined}
          hint="The ID is also the JSON key. Saving with an existing ID replaces that expansion."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="Name" value={draft.mExtensioName} onChange={(v) => patch({ mExtensioName: v })} />
          <NumberField label="ID" value={draft.mExtensioID} onChange={(v) => patch({ mExtensioID: v })} />
          <NumberField label="Gem cost" value={draft.mExtensioCost} onChange={(v) => patch({ mExtensioCost: v })} />
          <NumberField label="Reward ID" value={draft.mExtensioReward} onChange={(v) => patch({ mExtensioReward: v })} />
          <TextField label="Summary" value={draft.mExtensioSummaryText} onChange={(v) => patch({ mExtensioSummaryText: v })} />
          <label className="flex items-center gap-2 self-end text-sm text-fog">
            <input
              type="checkbox"
              checked={draft.mExtensioActive}
              onChange={(e) => patch({ mExtensioActive: e.target.checked })}
            />
            Active in shop
          </label>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={4}
                value={draft.mExtensioText}
                onChange={(e) => patch({ mExtensioText: e.target.value })}
              />
            </Field>
          </div>
          {imageField('Collection image', 'mExtensioCollectionImage')}
          {imageField('Header image', 'mExtensioHeaderImage')}
          {imageField('Unlock button', 'mExtensioUnlockButton')}
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(draft)}
          className={saveButtonClass}
        >
          {save.isPending ? 'Saving…' : 'Save expansion'}
        </button>
      </section>
    </div>
  )
}

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

  const [draft, setDraft] = useState<FrameData>({
    frameGem: 30,
    frameID: 900,
    frameRace: 0,
    frameRole: 0,
    frameType: 1,
  })
  const patch = (next: Partial<FrameData>) => setDraft((d) => ({ ...d, ...next }))
  const refreshImages = useImageRefresh()

  const save = usePanelSave<FrameData>({
    kind: 'Frame',
    queryName: 'frames',
    profileId,
    onStatus,
    onResult,
    save: (d) => createFrame(d),
    nameOf: (d) => `#${d.frameID}`,
    exists: (d) => Boolean(data[d.frameID]),
  })

  return (
    <div className="space-y-6">
      <p className="text-xs text-fog/80">
        Click a frame to view gem cost and race/role restrictions.
      </p>
      <ContentImageGrid
        profileId={profileId}
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
        />
      )}
      <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
        <EditorHeader
          title="Add or edit frame"
          loadLabel={selected ? `Frame ${selected.frameID}` : undefined}
          onLoad={selected ? () => setDraft({ ...selected }) : undefined}
          hint="Saving with an existing ID replaces that frame. Its picture is always frame_<ID>.webp."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <NumberField label="Frame ID" value={draft.frameID} onChange={(v) => patch({ frameID: v })} />
          <NumberField label="Gem cost" value={draft.frameGem} onChange={(v) => patch({ frameGem: v })} />
          <NumberField label="Type" value={draft.frameType} onChange={(v) => patch({ frameType: v })} />
          <NumberField label={`Race (${formatRaceId(draft.frameRace)})`} value={draft.frameRace} onChange={(v) => patch({ frameRace: v })} />
          <NumberField label={`Role (${formatRoleId(draft.frameRole)})`} value={draft.frameRole} onChange={(v) => patch({ frameRole: v })} />
          {profileId && (
            <ImageUploadField
              label={`Upload frame_${draft.frameID}.webp`}
              fileName={`frame_${draft.frameID}`}
              onUpload={liveImageUploader(onResult, refreshImages, 'frame', `frame_${draft.frameID}`, 'exact')}
            />
          )}
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(draft)}
          className={saveButtonClass}
        >
          {save.isPending ? 'Saving…' : `Save frame #${draft.frameID}`}
        </button>
      </section>
    </div>
  )
}

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

  const [draft, setDraft] = useState<PortraitData>({
    avatarGems: 0,
    avatarGenderID: 2,
    avatarID: 900,
    avatarName: 'New avatar',
    avatarRace: 1,
    avatarRole: 1,
    avatarType: 0,
  })
  const patch = (next: Partial<PortraitData>) => setDraft((d) => ({ ...d, ...next }))
  const refreshImages = useImageRefresh()

  const save = usePanelSave<PortraitData>({
    kind: 'Portrait',
    queryName: 'portraits',
    profileId,
    onStatus,
    onResult,
    save: (d) => createPortrait(d),
    nameOf: (d) => d.avatarName,
    exists: (d) => Boolean(data[d.avatarID]),
  })

  return (
    <div className="space-y-6">
      <p className="text-xs text-fog/80">
        Click a portrait to view avatar stats and creation defaults.
      </p>
      <ContentImageGrid
        profileId={profileId}
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
        />
      )}
      <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
        <EditorHeader
          title="Add or edit portrait"
          loadLabel={selected?.avatarName}
          onLoad={selected ? () => setDraft({ ...selected }) : undefined}
          hint="Saving with an existing ID replaces that portrait. Its picture is always avatar_<ID>.webp."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TextField label="Avatar name" value={draft.avatarName} onChange={(v) => patch({ avatarName: v })} />
          <NumberField label="Avatar ID" value={draft.avatarID} onChange={(v) => patch({ avatarID: v })} />
          <NumberField label="Gem cost" value={draft.avatarGems} onChange={(v) => patch({ avatarGems: v })} />
          <NumberField label={`Race (${formatRaceId(draft.avatarRace)})`} value={draft.avatarRace} onChange={(v) => patch({ avatarRace: v })} />
          <NumberField label={`Role (${formatRoleId(draft.avatarRole)})`} value={draft.avatarRole} onChange={(v) => patch({ avatarRole: v })} />
          <NumberField label={`Gender (${formatGenderId(draft.avatarGenderID)})`} value={draft.avatarGenderID} onChange={(v) => patch({ avatarGenderID: v })} />
          <NumberField label="Type" value={draft.avatarType} onChange={(v) => patch({ avatarType: v })} />
          {profileId && (
            <ImageUploadField
              label={`Upload avatar_${draft.avatarID}.webp`}
              fileName={`avatar_${draft.avatarID}`}
              onUpload={liveImageUploader(onResult, refreshImages, 'portrait', `avatar_${draft.avatarID}`, 'exact')}
            />
          )}
        </div>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(draft)}
          className={saveButtonClass}
        >
          {save.isPending ? 'Saving…' : 'Save portrait'}
        </button>
      </section>
    </div>
  )
}
