/** Live activity feed poll interval (ms) */
export const ACTIVITY_POLL_MS = 5_000

/** Online players list poll interval (ms) */
export const PLAYERS_POLL_MS = 5_000

const databaseUrl = (import.meta.env.VITE_DATABASE_URL ?? '').trim()

/** Query players directly from PostgreSQL in dev (VPS tunnel or local DB). */
export const useLocalPostgres =
  import.meta.env.DEV && databaseUrl.length > 0

export const localAdminApiBase = '/local-admin-api'

/** Read/write game JSON + images on disk via Vite dev server */
export const useLocalContent =
  import.meta.env.VITE_USE_LOCAL_CONTENT !== 'false' && import.meta.env.DEV

/** Static URLs served from MorkahjaWebApp `client/public` (dev) */
export const gameDataBaseUrl = useLocalContent
  ? '/game'
  : (import.meta.env.VITE_GAME_DATA_URL ?? '').replace(/\/$/, '')

export const uiBaseUrl = useLocalContent
  ? '/UI'
  : (import.meta.env.VITE_UI_URL ?? '').replace(/\/$/, '')

export function encounterImageUrl(imageName: string): string {
  if (!gameDataBaseUrl) return ''
  const file = imageName.endsWith('.webp') ? imageName : `${imageName}.webp`
  return `${gameDataBaseUrl}/encounterimages/${file}`
}

export function solutionImageUrl(iconName: string): string {
  if (!gameDataBaseUrl) return ''
  const file = iconName.endsWith('.webp') ? iconName : `${iconName}.webp`
  return `${gameDataBaseUrl}/solutionimages/${file}`
}

export function uiImageUrl(relativePath: string): string {
  if (!uiBaseUrl) return ''
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
  return `${uiBaseUrl}${path}`
}

export function expansionImageUrl(imageName: string): string {
  if (!imageName) return ''
  const file = imageName.endsWith('.webp') ? imageName : `${imageName}.webp`
  return uiImageUrl(`/03_DASHBOARD/expansions/${file}`)
}

export function frameImageUrl(frameId: number): string {
  return uiImageUrl(`/02_AvatarCreation/Frames/frame_${frameId}.webp`)
}

export function portraitImageUrl(avatarId: number): string {
  return uiImageUrl(`/02_AvatarCreation/Avatare/avatar_${avatarId}.webp`)
}
