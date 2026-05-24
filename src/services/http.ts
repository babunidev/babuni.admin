import { apiCredentials, buildApiUrl } from '../config/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function authHeaders(): HeadersInit {
  const token = import.meta.env.VITE_API_TOKEN?.trim()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function apiRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...init.headers,
    },
    credentials: apiCredentials,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new ApiError(
      response.status,
      body || `Request failed (${response.status})`,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export async function pingApi(): Promise<boolean> {
  try {
    await apiGet('/server')
    return true
  } catch {
    return false
  }
}
