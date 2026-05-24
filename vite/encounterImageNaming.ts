import { existsSync, readdirSync } from 'node:fs'

/** Lowercase snake_case base name (no extension), matching game encounter image ids. */
export function slugifyEncounterImageBase(
  title: string,
  fallback = 'encounter',
): string {
  const slug = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)

  return slug || fallback
}

export function listEncounterImageBases(encounterImagesDir: string): Set<string> {
  if (!existsSync(encounterImagesDir)) return new Set()

  return new Set(
    readdirSync(encounterImagesDir)
      .filter((name) => name.toLowerCase().endsWith('.webp'))
      .map((name) => name.slice(0, -'.webp'.length)),
  )
}

/** Picks `base`, or `2_base`, `3_base`, … when a .webp file already exists. */
export function pickUniqueEncounterImageBase(
  existing: Set<string>,
  base: string,
): string {
  if (!existing.has(base)) return base

  for (let prefix = 2; prefix < 10_000; prefix++) {
    const candidate = `${prefix}_${base}`
    if (!existing.has(candidate)) return candidate
  }

  return `${Date.now()}_${base}`
}

export function resolveEncounterImageBase(
  encounterImagesDir: string,
  title: string,
  fallback = 'encounter',
): string {
  const base = slugifyEncounterImageBase(title, fallback)
  const existing = listEncounterImageBases(encounterImagesDir)
  return pickUniqueEncounterImageBase(existing, base)
}
