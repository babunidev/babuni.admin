import type { SaveResult, SaveStep } from '../components/SaveResultDialog'
import type {
  CatalogSaveReport,
  ContentGitResult,
  ImageUploadReport,
  RemoteImageKind,
  ServiceStep,
} from '../services/contentApi'
import type { UploadProgress } from './pendingImages'
import { gitSteps, imageLabels, imageUploadResult, liveCatalogStep, prefixed } from './saveResults'

type CatalogKind = Parameters<typeof liveCatalogStep>[0]

/** What a save is about to do, known as soon as Save is pressed. */
export interface SavePlan {
  kind: CatalogKind
  name: string
  images: { kind: RemoteImageKind; name: string }[]
}

/** The save popup while a save runs: tick off steps as the server reports them. */
export interface SaveProgress {
  uploads: UploadProgress
  record: (step: ServiceStep) => void
}

const working: Record<string, string> = {
  live: 'Writing to the game server and reading it back…',
  public: 'Downloading it from the public game address…',
  local: 'Committing in MorkahjaWebApp on main…',
  github: 'Pushing to GitHub main…',
}

function planned(id: string, label: string, phase: keyof typeof working): SaveStep {
  return { id, label, state: 'pending', detail: working[phase] }
}

/** Every image comes before the record, in the order the save runs them. */
function plannedSteps(plan: SavePlan): SaveStep[] {
  const images = plan.images.flatMap((image, index) => {
    const prefix = `${imageLabels[image.kind]} ${image.name}`
    return [
      planned(`image${index}:live`, `${prefix} · Live server`, 'live'),
      planned(`image${index}:public`, `${prefix} · Visible to players`, 'public'),
      planned(`image${index}:local`, `${prefix} · Local game`, 'local'),
      planned(`image${index}:github`, `${prefix} · GitHub`, 'github'),
    ]
  })
  return [
    ...images,
    planned('record:live', 'Live game', 'live'),
    planned('record:local', 'Local game', 'local'),
    planned('record:github', 'GitHub', 'github'),
  ]
}

/** The first waiting step gets the hourglass when nothing else is running. */
function advance(steps: SaveStep[]): SaveStep[] {
  if (steps.some((step) => step.state === 'working')) return steps
  const next = steps.findIndex((step) => step.state === 'pending')
  return next < 0 ? steps : steps.map((step, index) => (index === next ? { ...step, state: 'working' } : step))
}

/** Its local commit is done; the GitHub push is still running. */
function committedStep(git: ContentGitResult | undefined): SaveStep {
  return gitSteps(git)[0]
}

/**
 * Shows the whole save at once, with every step waiting, and moves the
 * hourglass along as the local service reports each step. The final result
 * (or failure) replaces it through the normal popup when the save ends.
 */
export function startSaveProgress(plan: SavePlan, show: (result: SaveResult) => void): SaveProgress {
  let result: SaveResult = {
    title: `Saving ${plan.kind.toLowerCase()}: ${plan.name}`,
    steps: advance(plannedSteps(plan)),
  }
  show(result)

  const replace = (changes: Record<string, SaveStep | SaveStep[]>) => {
    const steps = result.steps.flatMap((step) => {
      const change = step.id ? changes[step.id] : undefined
      if (!change) return [step]
      // A single step keeps its planned id and label (with any image prefix).
      return Array.isArray(change) ? change : [{ ...change, id: step.id, label: step.label }]
    })
    result = { ...result, steps: advance(steps) }
    show(result)
  }

  const onLocal = (prefix: string, step: ServiceStep) => {
    const git = step.git as ContentGitResult | undefined
    replace({ [`${prefix}:local`]: committedStep(git) })
  }

  return {
    uploads: {
      step: (index, step) => {
        const id = `image${index}`
        if (step.step === 'live') {
          const check = step.publicCheck as ImageUploadReport['publicCheck'] | undefined
          replace({
            [`${id}:live`]: {
              label: '',
              state: 'ok',
              detail: step.replaced ? 'Replaced in the game’s image folder and read back.' : 'Added to the game’s image folder and read back.',
            },
            [`${id}:public`]: {
              label: '',
              state: check?.ok ? 'ok' : 'failed',
              detail: check?.ok
                ? 'Downloaded from the public game address; the bytes match your file.'
                : 'The public address does not serve this file yet.',
            },
          })
        } else if (step.step === 'local') onLocal(id, step)
      },
      // The finished upload replaces its four planned steps with the real ones.
      done: (index, report) => {
        const id = `image${index}`
        const prefix = `${imageLabels[report.kind]} ${report.name}`
        const real = prefixed(prefix, imageUploadResult(report)).map((step, n) => ({ ...step, id: `${id}:done${n}` }))
        const changes: Record<string, SaveStep | SaveStep[]> = { [`${id}:live`]: real }
        for (const phase of ['public', 'local', 'github']) changes[`${id}:${phase}`] = []
        replace(changes)
      },
    },
    record: (step) => {
      if (step.step === 'live') {
        replace({ 'record:live': liveCatalogStep(plan.kind, step.via as CatalogSaveReport['via']) })
      } else if (step.step === 'local') onLocal('record', step)
    },
  }
}
