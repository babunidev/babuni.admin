import type { SaveResult, SaveStep } from '../components/SaveResultDialog'
import type {
  CatalogSaveReport,
  ContentGitResult,
  ImageUploadReport,
  RemoteImageKind,
} from '../services/contentApi'

const catalogFiles: Record<string, string> = {
  Encounter: 'encountersdata.json',
  Solution: 'solutiondata.json',
  Expansion: 'expansiondata.json',
  Frame: 'frames.json',
  Portrait: 'portraits.json',
}

const imageLabels: Record<RemoteImageKind, string> = {
  encounter: 'Encounter image',
  solution: 'Solution icon',
  expansion: 'Expansion image',
  frame: 'Frame image',
  portrait: 'Portrait image',
}

/** Plain words for the error codes a content creator can run into. */
export function describeSaveError(code: string): string {
  const known: Record<string, string> = {
    CONTENT_CONFLICT:
      'The live catalog changed after you opened it. Reload the page and make the edit again.',
    CONTENT_REVISION_REQUIRED: 'The catalog was not loaded from the server yet. Reload the page.',
    CONTENT_PROFILE_REQUIRED: 'The administrator connection is not set up. Open Connection.',
    CONTENT_PERMISSION_DENIED:
      'The game server refused the write. Check ADMIN_API_KEY on the server and the file owner.',
    CONTENT_OPERATION_FAILED: 'The game server did not accept the save (is the game running?).',
    CONTENT_WRITE_VERIFY_FAILED:
      'The save was sent, but reading the catalog back did not show it. Reload and check.',
    CONTENT_INVALID_RECORD: 'The record is missing a required field or has an id that is out of range.',
    CONTENT_INVALID_REQUEST: 'The key or id is not valid for this catalog.',
    REMOTE_CONTENT_BUSY: 'Another save is still running. Try again in a moment.',
    REMOTE_CONTENT_TIMEOUT: 'The server did not answer in time.',
    REMOTE_MODERATION_DISABLED: 'The administrator connection is turned off in this session.',
    SSH_AUTH_REJECTED: 'The server rejected the SSH key. Is the key loaded in your SSH agent?',
    LOCAL_SERVICE_UNAVAILABLE: 'The local Babuni Admin service is not running.',
    IMAGE_PERMISSION_DENIED: 'Your SSH login may not write into this image folder on the server.',
    IMAGE_FOLDER_UNAVAILABLE:
      'The upload folder is missing on the server. Run scripts/morkahja-image-uploads-setup.py there once.',
    IMAGE_NOT_WEBP: 'The file could not be turned into a WebP image.',
    IMAGE_TOO_LARGE: 'The image is larger than 2 MB after conversion.',
    INVALID_IMAGE_NAME: 'Use only letters, numbers, _ and - in the image name.',
    IMAGE_TARGET_UNSAFE: 'Something other than a normal file already has that name on the server.',
    IMAGE_WRITE_VERIFY_FAILED: 'The server copy differs from the file you chose.',
    IMAGE_WRITE_BUSY: 'Another image upload is still running.',
    CONTENT_GIT_FAILED: 'The commit in MorkahjaWebApp failed. Save again to retry.',
    CONTENT_GIT_PUSH_FAILED: 'GitHub refused the push. Push main from MorkahjaWebApp when ready.',
    CONTENT_GIT_NOT_MAIN: 'MorkahjaWebApp is not on main, so nothing was written there.',
    CONTENT_GIT_DIVERGED:
      'MorkahjaWebApp main and GitHub main both have commits the other lacks; nothing was written locally.',
    CONTENT_GIT_BEHIND:
      'MorkahjaWebApp is behind GitHub and could not catch up without touching your uncommitted edits; nothing was written locally.',
    CONTENT_GIT_OFFLINE: 'GitHub could not be reached; the commit stays in MorkahjaWebApp until you push.',
    CONTENT_GIT_UNPUBLISHED:
      'MorkahjaWebApp main has your own commits that are not on GitHub yet, so nothing was pushed; push main when ready.',
  }
  return known[code] ? `${known[code]} (${code})` : code
}

/** The save in Babuni's local game (MorkahjaWebApp, main) and on GitHub main. */
function gitSteps(git: ContentGitResult | undefined): SaveStep[] {
  if (git?.ok && git.skipped) {
    return [{ label: 'Local game', state: 'skipped', detail: 'MorkahjaWebApp already had exactly this version.' }]
  }
  if (git?.ok && git.commit) {
    const local: SaveStep = {
      label: 'Local game',
      state: 'ok',
      detail: `Committed in MorkahjaWebApp on main as ${git.commit}: “${git.message ?? ''}”.`,
    }
    const github: SaveStep = git.pushed
      ? {
          label: 'GitHub',
          state: 'ok',
          detail: `Pushed to main.`,
          href: git.url,
          hrefLabel: git.url ? 'Open the commit on GitHub' : undefined,
        }
      : { label: 'GitHub', state: 'failed', detail: `Not pushed. ${describeSaveError(git.code ?? 'CONTENT_GIT_PUSH_FAILED')}` }
    return [local, github]
  }
  return [{
    label: 'Local game',
    state: 'failed',
    detail: `Not committed. ${describeSaveError(git?.code ?? 'CONTENT_GIT_FAILED')} The live game keeps the change.`,
  }]
}

export function catalogSaveResult(
  kind: keyof typeof catalogFiles,
  name: string,
  wasEdit: boolean,
  report: CatalogSaveReport,
): SaveResult {
  const file = catalogFiles[kind]
  return {
    title: `${kind} ${wasEdit ? 'updated' : 'added'}: ${name}`,
    subtitle: report.checkedAt ? `Saved ${new Date(report.checkedAt).toLocaleString()}` : undefined,
    steps: [
      {
        label: 'Live game',
        state: 'ok',
        detail:
          report.via === 'file'
            ? `Written to ${file} on the server and read back unchanged.`
            : `The running game wrote ${file}, dropped its cached copy, and the record read back unchanged. Players get it the next time the game loads content.`,
      },
      ...gitSteps(report.git),
    ],
  }
}

export function catalogFailureResult(
  kind: string,
  name: string,
  error: Error,
  uploaded: ImageUploadReport[] = [],
): SaveResult {
  const failed: SaveResult = {
    title: `${kind} not saved: ${name}`,
    steps: [{ label: 'Live game', state: 'failed', detail: describeSaveError(error.message) }],
    notes: ['Nothing was committed to GitHub. Your edit is still in the form.'],
  }
  if (uploaded.length === 0) return failed
  return {
    ...withImageResults({ ...failed, notes: [] }, uploaded),
    notes: ['The new image is saved, but the record is not. Your edit is still in the form; press Save again.'],
  }
}

export function imageUploadResult(report: ImageUploadReport, notes: string[] = []): SaveResult {
  const kb = Math.max(1, Math.round(report.size / 1024))
  return {
    title: `${imageLabels[report.kind]} ${report.replaced ? 'replaced' : 'added'}: ${report.name}`,
    subtitle: `${kb} KB WebP`,
    steps: [
      {
        label: 'Live server',
        state: 'ok',
        detail: report.replaced
          ? `Replaced ${report.name} in the game's image folder and read it back.`
          : `Added ${report.name} to the game's image folder and read it back.`,
      },
      report.publicCheck.ok
        ? {
            label: 'Visible to players',
            state: 'ok',
            detail: 'Downloaded from the public game address; the bytes match your file.',
            href: report.publicCheck.url,
          }
        : {
            label: 'Visible to players',
            state: 'failed',
            detail:
              report.publicCheck.status === 200
                ? 'The public address still serves a different (older) file. It may be cached; check again in a minute.'
                : `The public address answered ${report.publicCheck.status || 'nothing'}. The server folder may not be the one players get images from.`,
            href: report.publicCheck.url,
          },
      ...gitSteps(report.git),
    ],
    notes: [
      ...notes,
      'The GitHub copy lives in client/public, so the next game release keeps this image.',
    ],
  }
}

/** Image steps under their own heading, so they read apart from the record's steps. */
function prefixed(prefix: string, result: SaveResult): SaveStep[] {
  return result.steps.map((step) => ({ ...step, label: `${prefix} · ${step.label}` }))
}

/** One popup for a save that also uploaded the images chosen in the editor. */
export function withImageResults(main: SaveResult, reports: ImageUploadReport[]): SaveResult {
  if (reports.length === 0) return main
  const images = reports.map((report) => ({ report, result: imageUploadResult(report) }))
  return {
    title: main.title,
    subtitle: images.map(({ result }) => result.title).join(' · '),
    steps: [
      ...images.flatMap(({ report, result }) => prefixed(`${imageLabels[report.kind]} ${report.name}`, result)),
      ...main.steps,
    ],
    notes: [...new Set([...(main.notes ?? []), ...images.flatMap(({ result }) => result.notes ?? [])])],
  }
}

/** An image upload failed during a save, so the record was not saved. */
export function imageSaveFailureResult(
  kind: string,
  name: string,
  failedImage: RemoteImageKind,
  error: Error,
  uploaded: ImageUploadReport[],
): SaveResult {
  const done = withImageResults({ title: '', steps: [] }, uploaded)
  return {
    title: `${kind} not saved: ${name}`,
    steps: [
      ...done.steps,
      { label: imageLabels[failedImage], state: 'failed', detail: describeSaveError(error.message) },
      { label: 'Record', state: 'skipped', detail: 'Not saved, because the image upload failed.' },
    ],
    notes: ['Your edit and the chosen image are still in the editor; press Save again to retry.'],
  }
}
