import { localConnectionApi } from '../../../shared/services/localConnectionClient'
import { describeError as describeDocumentError } from './portfolioDocuments'

export interface CheckoutState {
  fetched: boolean
  branch: string
  snapshotDirty: boolean
  ahead: number
  behind: number
  aheadOnlySnapshot: boolean
  head: string
  originMain: string
  otherDirty: number
}
export interface SourcesResponse { sources: string[]; state: CheckoutState; busy: string | null }

export interface DocumentChange { kind: 'NEW' | 'CHANGED' | 'REMOVED'; path: string }
export interface RepositoryPull {
  repository: string
  changed: boolean
  from?: string
  to?: string
  headMoved?: boolean
  changes: DocumentChange[]
}
export interface PullResult {
  ok: boolean
  write: boolean
  written?: boolean
  repositories: RepositoryPull[]
  changedCount: number
  removedCount: number
  summary: string | null
  error?: string
}
export interface PushResult { ok: boolean; commit: string; repositories: number | null; error?: string }
export interface SiteChange { kind: 'CHANGED' | 'ADDED' | 'REMOVED'; path: string }
export interface SiteResult {
  ok: boolean
  apply: boolean
  commit: string | null
  liveRelease: string | null
  buildFiles: number | null
  nothing: boolean
  differCount: number | null
  creating: string | null
  newRelease: string | null
  published: boolean
  rollback: string | null
  changes: SiteChange[]
  counts: Record<SiteChange['kind'], number>
  total: number
  truncated: boolean
  error?: string
}

export const loadSources = () => localConnectionApi<SourcesResponse>('GET', '/portfolio/sources')
export const checkPull = (target: string) =>
  localConnectionApi<PullResult>('POST', '/portfolio/pull-check', { target })
export const writePull = (target: string, acceptRemovals: boolean) =>
  localConnectionApi<PullResult>('POST', '/portfolio/pull-write', { target, acceptRemovals })
export const pushSnapshot = () => localConnectionApi<PushResult>('POST', '/portfolio/snapshot-push', {})
export const checkSite = () => localConnectionApi<SiteResult>('POST', '/portfolio/site-check', {})
export const publishSite = () => localConnectionApi<SiteResult>('POST', '/portfolio/site-publish', {})

export interface LiveRelease { name: string; commit: string; kind: 'site' | 'doc' }
export interface SiteStatus {
  state: CheckoutState
  live: LiveRelease | null
  pendingCommits: { commit: string; subject: string }[] | null
  snapshotWaiting: boolean
  upToDate: boolean
  busy: string | null
}
export interface RepositoryChanges extends PullResult {
  checkedAt: string
  cached: boolean
  notOnWebsite: { repository: string; private: boolean }[] | null
}
export interface PublishAllResult {
  ok: boolean
  step?: 'pull' | 'push' | 'site'
  error?: string
  steps: { pull: PullResult | null; push: PushResult | null; site: SiteResult | null }
}

export const loadSiteStatus = () => localConnectionApi<SiteStatus>('GET', '/portfolio/site-status')
export const loadChanges = (refresh: boolean) =>
  localConnectionApi<RepositoryChanges>('POST', '/portfolio/changes', { refresh })
export const publishEverything = (acceptRemovals: boolean) =>
  localConnectionApi<PublishAllResult>('POST', '/portfolio/publish-all', { acceptRemovals })

export interface ReleasePlan {
  ok: boolean
  current: string
  previous: string | null
  keep: string[]
  remove: string[]
  freedBytes: number
  other: string[]
  error?: string
}
export interface ReleaseCleanup { ok: boolean; current: string; removed: string[]; failed?: string[]; freedBytes: number; error?: string }
export const checkReleases = () => localConnectionApi<ReleasePlan>('POST', '/portfolio/releases-check', {})
export const cleanupReleases = () => localConnectionApi<ReleaseCleanup>('POST', '/portfolio/releases-cleanup', {})

const MESSAGES: Record<string, string> = {
  CHANGED_SINCE_CHECK: 'More documents would be removed than the check showed. Nothing was published; check again.',
  SOURCE_DENIED: 'That repository is not a connected source.',
  GITHUB_LOGIN_MISSING: 'The GitHub CLI is not logged in. Run gh auth login in a terminal, then retry.',
  SNAPSHOT_DIRTY: 'The document snapshot already has uncommitted changes from other work in the babuni.dev checkout. Commit and push that work first, then check again.',
  PULL_FAILED: 'The pull script failed. The snapshot was not changed.',
  PULL_TIMEOUT: 'The pull script took too long and was stopped.',
  PULL_START_FAILED: 'The pull script could not be started.',
  CHECK_REQUIRED: 'Run the check again first; the last one is missing or out of date.',
  REMOVALS_NOT_ACCEPTED: 'This update removes documents from the website. Confirm the removals first.',
  FETCH_FAILED: 'GitHub could not be reached to compare with origin/main.',
  NOT_ON_MAIN: 'The babuni.dev checkout is not on the main branch.',
  BEHIND_ORIGIN: 'The babuni.dev checkout is behind origin/main. Pull it in a terminal first.',
  UNPUSHED_OTHER_COMMITS: 'The checkout has unpushed commits that change other files. Push or remove them in a terminal; this page only pushes the snapshot.',
  NOTHING_TO_COMMIT: 'There is no snapshot change to commit or push.',
  COMMIT_FAILED: 'The snapshot commit failed. Nothing was pushed.',
  PUSH_FAILED: 'The commit was made locally but could not be pushed. Retry, or push in a terminal.',
  ORIGIN_MOVED: 'origin/main changed since the dry run. Run the dry run again.',
  BUILD_FAILED: 'The website build failed. Nothing was published.',
  VERIFY_FAILED: 'The new release did not verify on the live site, so it was switched back to the previous release.',
  PUBLISH_UNVERIFIED: 'The release was created but the live check did not confirm it. Check https://www.babuni.dev/release.txt before doing anything else.',
  NOTHING_TO_REMOVE: 'There are no old releases to remove.',
  PLAN_STALE: 'The live release changed since the check. Nothing was removed; check again.',
  REMOVE_PARTIAL: 'Some old releases could not be removed. The live site is unaffected; check again.',
  LIVE_RELEASE_UNKNOWN: 'The live release on the server could not be identified, so nothing was removed.',
  ADMIN_CONNECTION_MISSING: 'The server connection is not set up on the Connection page.',
  PORTFOLIO_DEPLOY_KEY_UNAVAILABLE: 'The website deployment key is missing or has unsafe permissions.',
  RELEASES_SSH_TIMEOUT: 'The server did not answer in time.',
  RELEASES_SSH_UNAVAILABLE: 'SSH could not be started.',
  RELEASES_SSH_FAILED: 'The SSH login to the website server failed. Is the deployment key loaded in your SSH agent?',
  RELEASES_INVALID_RESPONSE: 'The server gave an unexpected answer, so nothing was removed.',
  PORTFOLIO_OPERATION_FAILED: 'The operation failed unexpectedly.',
}
export const describeSiteError = (code: string) => MESSAGES[code] ?? describeDocumentError(code)
