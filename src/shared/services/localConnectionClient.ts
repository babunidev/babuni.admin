import { reportLocalService } from '../../app/localServicePresence'

let uiSession:Promise<string>|null=null
function sessionToken():Promise<string> {
  if (!uiSession) {
    uiSession=fetch('/local-connections-api/session',{
      cache:'no-store',headers:{'X-Babuni-Local':'1'},
    }).then(async response=>{
      if (!response.ok) {
        if (response.status>=500) reportLocalService(false)
        throw new Error('LOCAL_SESSION_UNAVAILABLE')
      }
      reportLocalService(true)
      const json=await response.json() as {session?:string}
      if (!json.session || json.session.length<32) throw new Error('LOCAL_SESSION_UNAVAILABLE')
      return json.session
    }).catch(error=>{
      uiSession=null
      if (!(error instanceof Error) || error.message!=='LOCAL_SESSION_UNAVAILABLE') reportLocalService(false)
      throw error
    })
  }
  return uiSession
}
export async function localConnectionApi<T>(method='GET',path='/',data?:unknown):Promise<T> {
  const session=await sessionToken()
  let result:Response
  try {
    result=await fetch('/local-connections-api'+path,{
      method,cache:'no-store',
      headers:{'Content-Type':'application/json','X-Babuni-Local':'1','X-Babuni-Session':session},
      body:data===undefined?undefined:JSON.stringify(data),
    })
  } catch {
    reportLocalService(false)
    throw new Error('LOCAL_SERVICE_UNAVAILABLE')
  }
  let value:{error?:string;status?:{code?:string}}
  try {value=await result.json() as typeof value}
  catch {throw new Error('INVALID_SERVICE_RESPONSE')}
  if (!result.ok) {
    if (result.status>=500) reportLocalService(false)
    else reportLocalService(true)
    if (result.status===403) uiSession=null
    const error = new Error(value.error||value.status?.code||'LOCAL_SERVICE_FAILURE')
    ;(error as Error & { detail?: unknown }).detail = value
    throw error
  }
  return value as unknown as T
}
