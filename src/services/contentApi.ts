import { useLocalContent } from '../config/constants'
import type {
  EncounterMap,
  ExpansionData,
  ExpansionDataFile,
  FramesDataFile,
  PortraitsDataFile,
  SolutionMap,
} from '../types/gameContent'
import { imageFileToWebpBase64 } from '../utils/imageFileToWebpBase64'
import { apiPost } from './http'

const LOCAL_API = '/local-content-api'

async function localGet<T>(path: string): Promise<T> {
  const response = await fetch(`${LOCAL_API}${path}`)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `Failed to load ${path} (${response.status})`)
  }
  return response.json() as Promise<T>
}

async function localPost(path: string, body: unknown): Promise<void> {
  await localPostJson(path, body)
}

async function localPostJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${LOCAL_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Save failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

async function fetchGameJson<T>(fileName: string): Promise<T> {
  const response = await fetch(`/game/${fileName}`)
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName} (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function fetchEncounters(): Promise<EncounterMap> {
  if (useLocalContent) return localGet('/encounters')
  return fetchGameJson('encountersdata.json')
}

export async function fetchSolutions(): Promise<SolutionMap> {
  if (useLocalContent) return localGet('/solutions')
  return fetchGameJson('solutiondata.json')
}

export async function fetchExpansions(): Promise<ExpansionDataFile> {
  if (useLocalContent) return localGet('/expansions')
  return fetchGameJson('expansiondata.json')
}

export async function fetchFrames(): Promise<FramesDataFile> {
  if (useLocalContent) return localGet('/frames')
  return fetchGameJson('frames.json')
}

export async function fetchPortraits(): Promise<PortraitsDataFile> {
  if (useLocalContent) return localGet('/portraits')
  return fetchGameJson('portraits')
}

export async function createEncounter(
  key: string,
  data: EncounterMap[string],
): Promise<void> {
  if (useLocalContent) {
    await localPost('/encounters', { key, data })
    return
  }
  await apiPost('/content/encounters', { key, data })
}

export async function createSolution(
  key: string,
  data: SolutionMap[string],
): Promise<void> {
  if (useLocalContent) {
    await localPost('/solutions', { key, data })
    return
  }
  await apiPost('/content/solutions', { key, data })
}

export async function createExpansion(
  key: string,
  data: ExpansionData,
): Promise<void> {
  if (useLocalContent) {
    await localPost('/expansions', { key, data })
    return
  }
  await apiPost('/content/expansions', { key, data })
}

export async function createFrame(
  data: NonNullable<FramesDataFile['Frames'][number]>,
): Promise<void> {
  if (useLocalContent) {
    await localPost('/frames', data)
    return
  }
  await apiPost('/content/frames', data)
}

export async function createPortrait(
  data: NonNullable<PortraitsDataFile['Avatar'][number]>,
): Promise<void> {
  if (useLocalContent) {
    await localPost('/portraits', data)
    return
  }
  await apiPost('/content/portraits', data)
}

export async function uploadEncounterImage(
  fileName: string,
  file: File,
): Promise<void> {
  if (!useLocalContent) {
    throw new Error('Image upload only available with local content enabled')
  }

  const dataBase64 = await fileToBase64(file)
  await localPost('/upload/encounter-image', { fileName, dataBase64 })
}

/** Saves under encounterimages/ with a slug from the title; adds 2_, 3_, … if taken. */
export async function uploadEncounterImageFromTitle(
  encounterTitle: string,
  encounterId: number,
  file: File,
): Promise<string> {
  if (!useLocalContent) {
    throw new Error('Image upload only available with local content enabled')
  }

  const dataBase64 = await imageFileToWebpBase64(file)
  const result = await localPostJson<{ imageName: string }>(
    '/upload/encounter-image',
    {
      encounterTitle,
      encounterId,
      dataBase64,
    },
  )
  if (!result.imageName) {
    throw new Error('Upload succeeded but no image name was returned')
  }
  return result.imageName
}

export async function uploadSolutionImage(
  fileName: string,
  file: File,
): Promise<void> {
  if (!useLocalContent) {
    throw new Error('Image upload only available with local content enabled')
  }

  const dataBase64 = await fileToBase64(file)
  await localPost('/upload/solution-image', { fileName, dataBase64 })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'))
        return
      }
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Failed to encode file'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function fetchLocalContentStatus(): Promise<{
  ok: boolean
  gameDir: string
}> {
  return localGet('/status')
}
