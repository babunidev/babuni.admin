const listeners = new Set<(online: boolean) => void>()

/** True when nothing answered, or the local process answered with a server error. */
export function localServiceOffline(response: { ok: boolean; status: number } | null): boolean {
  if (!response) return true
  return response.status >= 500
}

export function reportLocalService(online: boolean) {
  for (const listener of listeners) listener(online)
}

export function onLocalServicePresence(listener: (online: boolean) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function probeLocalService(): Promise<boolean> {
  try {
    const response = await fetch('/local-connections-api/session', {
      cache: 'no-store',
      headers: { 'X-Babuni-Local': '1' },
    })
    const online = !localServiceOffline(response)
    reportLocalService(online)
    return online
  } catch {
    reportLocalService(false)
    return false
  }
}
