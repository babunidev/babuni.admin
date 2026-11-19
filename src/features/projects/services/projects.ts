import { localConnectionApi } from '../../../shared/services/localConnectionClient'

export interface ProjectCommit { commit: string; subject: string; date: string; url: string }
export interface ChangelogEntry { date: string; title: string | null; body: string }
export interface Project {
  id: string
  name: string
  summary: string | null
  tint: string | null
  status: string
  repository: string | null
  branch: string | null
  url?: string
  private?: boolean
  readError?: string
  commits?: ProjectCommit[]
  lastCommitAt?: string | null
  changelog?: ChangelogEntry | null
  lastWorkedOn?: string | null
  lastWorkedFrom?: 'changelog' | 'commit' | null
  daysSince?: number | null
  needsRevision: boolean
}
export interface ProjectOverview { ok: boolean; checkedAt: string; cached: boolean; revision: string | null; projects: Project[] }
export interface ProjectDocumentList {
  ok: boolean
  id: string
  repository: string
  branch: string
  documents: { path: string; size: number }[]
}
export interface ProjectDocument { ok: boolean; id: string; repository: string; path: string; body: string }

export const loadProjects = (refresh: boolean) =>
  localConnectionApi<ProjectOverview>('POST', '/projects/list', { refresh })
export const loadProjectDocuments = (id: string) =>
  localConnectionApi<ProjectDocumentList>('POST', '/projects/documents', { id })
export const loadProjectDocument = (id: string, path: string) =>
  localConnectionApi<ProjectDocument>('POST', '/projects/document', { id, path })

const MESSAGES: Record<string, string> = {
  CHECKOUT_UNAVAILABLE: 'The babuni.dev checkout could not be read, so the website’s project list is unknown.',
  GITHUB_READ_FAILED: 'GitHub could not be read. Is the GitHub CLI logged in (gh auth status)?',
  PROJECT_UNKNOWN: 'That project is not on the website.',
  PROJECT_NOT_CONNECTED: 'This project has no connected repository yet.',
  DOCUMENT_NOT_LISTED: 'That document is not in the project’s repository any more. Reload the project.',
  DOCUMENT_TOO_LARGE: 'The document is too large to show here.',
  REPOSITORY_NOT_FOUND: 'GitHub did not find this repository.',
  BRANCH_NOT_FOUND: 'GitHub did not find the connected branch.',
  LOCAL_SERVICE_UNAVAILABLE: 'The local Babuni Admin service is not running.',
}
export const describeProjectError = (code: string) => MESSAGES[code] ?? 'The projects overview failed unexpectedly.'

/** Documents shown as quick cards, wherever the repository keeps them. */
export const KEY_DOCUMENTS = ['CHANGELOG', 'DEVLOG', 'ROADMAP', 'README', 'CONCEPT'] as const
export function keyDocument(paths: string[], name: string): string | null {
  const candidates = [`${name}.md`, `docs/${name}.md`]
  return candidates.find(c => paths.includes(c)) ?? null
}
