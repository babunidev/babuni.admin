import { useLocalContent } from '../../../config/constants'
import type {
  EncounterMap,
  ExpansionData,
  ExpansionDataFile,
  FramesDataFile,
  PortraitsDataFile,
  SolutionMap,
} from '../types/gameContent'
import { imageFileToWebpBase64 } from '../utils/imageFileToWebpBase64'
import { apiPost } from '../../../services/http'

const LOCAL_API = '/local-content-api'
const protectedContent = import.meta.env.VITE_USE_PROTECTED_CONTENT === 'true'
const contentProfileId = import.meta.env.VITE_MORKAHJA_PROFILE_ID?.trim() ?? ''
let localSessionPromise: Promise<string> | null = null
async function getLocalSession(): Promise<string> {
  if (!localSessionPromise) {
    localSessionPromise = fetch('/local-connections-api/session',{
      cache:'no-store',headers:{'X-Babuni-Local':'1'},
    }).then(async response=>{
      if(!response.ok)throw new Error('Local session unavailable')
      const result=await response.json() as {session?:string}
      if(!result.session)throw new Error('Local session unavailable')
      return result.session
    }).catch(error=>{localSessionPromise=null;throw error})
  }
  return localSessionPromise
}
async function protectedRequest<T>(method:string,path:string,body?:unknown):Promise<T> {
  if(!/^[0-9a-f-]{36}$/i.test(contentProfileId))throw new Error('Protected Morkahja local-files profile ID is not configured')
  const session=await getLocalSession()
  const response=await fetch('/local-connections-api/'+contentProfileId+path,{
    method,cache:'no-store',
    headers:{'X-Babuni-Local':'1','X-Babuni-Session':session,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
  })
  let result:{error?:string;revision?:string}
  try{result=await response.json() as typeof result}
  catch{throw new Error('Invalid local service response')}
  if(!response.ok) {
    if(response.status===403)localSessionPromise=null
    throw new Error(result.error||'Protected content operation failed')
  }
  return result as T
}
async function protectedSave(dataset:string,key:string,data:unknown):Promise<void> {
  const path='/content/'+dataset+'/'+encodeURIComponent(key)
  const preview=await protectedRequest<{revision:string}>('GET',path)
  await protectedRequest('PUT',path,{expectedRevision:preview.revision,data,confirm:true})
}

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
  const result = (await response.json()) as T & { ok?: boolean; error?: string; message?: string }
  if (result && typeof result === 'object' && result.ok === false) {
    throw new Error(result.message || result.error || 'Content save failed')
  }
  return result
}

async function confirmedRemotePost(path: string, body: unknown): Promise<void> {
  const result = await apiPost<{ ok?: boolean; message?: string; error?: string }>(path, body)
  if (result && typeof result === 'object' && result.ok === false) {
    throw new Error(result.message || result.error || 'Content save failed')
  }
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
  if (protectedContent) return protectedSave('encounters',key,data)
  if (useLocalContent) {
    await localPost('/encounters', { key, data })
    return
  }
  await confirmedRemotePost('/content/encounters', { key, data })
}

export async function createSolution(
  key: string,
  data: SolutionMap[string],
): Promise<void> {
  if (protectedContent) return protectedSave('solutions',key,data)
  if (useLocalContent) {
    await localPost('/solutions', { key, data })
    return
  }
  await confirmedRemotePost('/content/solutions', { key, data })
}

export async function createExpansion(
  key: string,
  data: ExpansionData,
): Promise<void> {
  if (protectedContent) return protectedSave('expansions',key,data)
  if (useLocalContent) {
    await localPost('/expansions', { key, data })
    return
  }
  await confirmedRemotePost('/content/expansions', { key, data })
}

export async function createFrame(
  data: NonNullable<FramesDataFile['Frames'][number]>,
): Promise<void> {
  if (protectedContent) return protectedSave('frames',String(data.frameID),data)
  if (useLocalContent) {
    await localPost('/frames', data)
    return
  }
  await confirmedRemotePost('/content/frames', data)
}

export async function createPortrait(
  data: NonNullable<PortraitsDataFile['Avatar'][number]>,
): Promise<void> {
  if (protectedContent) return protectedSave('portraits',String(data.avatarID),data)
  if (useLocalContent) {
    await localPost('/portraits', data)
    return
  }
  await confirmedRemotePost('/content/portraits', data)
}

export async function uploadEncounterImage(
  fileName: string,
  file: File,
): Promise<void> {
  if (protectedContent) throw new Error('Scoped image upload is not implemented; game files remain unchanged.')
  if (!useLocalContent) {
    throw new Error('Image upload only available with local content enabled')
  }

  const dataBase64 = await imageFileToWebpBase64(file)
  await localPost('/upload/encounter-image', { fileName, dataBase64 })
}

/** Saves under encounterimages/ with a slug from the title; adds 2_, 3_, … if taken. */
export async function uploadEncounterImageFromTitle(
  encounterTitle: string,
  encounterId: number,
  file: File,
): Promise<string> {
  if (protectedContent) throw new Error('Scoped image upload is not implemented; game files remain unchanged.')
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
  if (protectedContent) throw new Error('Scoped image upload is not implemented; game files remain unchanged.')
  if (!useLocalContent) {
    throw new Error('Image upload only available with local content enabled')
  }

  const dataBase64 = await imageFileToWebpBase64(file)
  await localPost('/upload/solution-image', { fileName, dataBase64 })
}

export async function fetchLocalContentStatus(): Promise<{
  ok: boolean
  gameDir: string
}> {
  return localGet('/status')
}
