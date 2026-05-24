import { useLocalPostgres } from './constants'

const rawBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const rawPrefix = (import.meta.env.VITE_API_PREFIX ?? '').trim()
const mockFlag = import.meta.env.VITE_USE_MOCK_DATA?.trim()

/** Public API root — empty means mock-only mode. */
export const apiBaseUrl = rawBase.replace(/\/$/, '')

/** Optional extra path after base (leave empty when base is already `/api/admin`). */
export const apiPrefix =
  rawPrefix.length === 0
    ? ''
    : rawPrefix.startsWith('/')
      ? rawPrefix.replace(/\/$/, '')
      : `/${rawPrefix.replace(/\/$/, '')}`

export const useMockData =
  mockFlag === 'true' || (mockFlag !== 'false' && apiBaseUrl.length === 0)

export const useDevProxy = apiBaseUrl.startsWith('/')

export const apiCredentials =
  import.meta.env.VITE_API_CREDENTIALS === 'include' ? 'include' : 'same-origin'

/** Shown in UI — never includes secrets. */
export function getApiDisplayLabel(): string {
  if (useLocalPostgres) return 'PostgreSQL (direct)'
  if (useMockData) return 'Mock (local)'
  if (useDevProxy) return `VPS via dev proxy (${apiBaseUrl})`
  try {
    const host = new URL(apiBaseUrl).host
    return `VPS (${host})`
  } catch {
    return apiBaseUrl
  }
}

export function buildApiUrl(path: string): string {
  const segment = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}${apiPrefix}${segment}`
}
