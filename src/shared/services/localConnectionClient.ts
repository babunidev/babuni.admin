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
async function request(method:string,path:string,data:unknown,accept?:string):Promise<Response> {
  const session=await sessionToken()
  try {
    return await fetch('/local-connections-api'+path,{
      method,cache:'no-store',
      headers:{
        'Content-Type':'application/json','X-Babuni-Local':'1','X-Babuni-Session':session,
        ...(accept?{Accept:accept}:{}),
      },
      body:data===undefined?undefined:JSON.stringify(data),
    })
  } catch {
    reportLocalService(false)
    throw new Error('LOCAL_SERVICE_UNAVAILABLE')
  }
}

type ServiceAnswer={error?:string;status?:{code?:string}}

function settle<T>(status:number,value:ServiceAnswer):T {
  if (status<200 || status>=300) {
    if (status>=500) reportLocalService(false)
    else reportLocalService(true)
    if (status===403) uiSession=null
    const error = new Error(value.error||value.status?.code||'LOCAL_SERVICE_FAILURE')
    ;(error as Error & { detail?: unknown }).detail = value
    throw error
  }
  return value as unknown as T
}

export async function localConnectionApi<T>(method='GET',path='/',data?:unknown):Promise<T> {
  const result=await request(method,path,data)
  let value:ServiceAnswer
  try {value=await result.json() as typeof value}
  catch {throw new Error('INVALID_SERVICE_RESPONSE')}
  return settle<T>(result.status,value)
}

/** One finished step of a save, as the local service reports it while working. */
export type ServiceStep={step:string;[field:string]:unknown}

/**
 * POST that hands each finished step to `onStep` as the local service reports
 * it, then resolves with the final answer exactly like `localConnectionApi`.
 */
export async function localConnectionStream<T>(path:string,data:unknown,onStep:(step:ServiceStep)=>void):Promise<T> {
  const result=await request('POST',path,data,'application/x-ndjson, application/json')
  if (!result.headers.get('Content-Type')?.includes('application/x-ndjson') || !result.body) {
    let value:ServiceAnswer
    try {value=await result.json() as typeof value}
    catch {throw new Error('INVALID_SERVICE_RESPONSE')}
    return settle<T>(result.status,value)
  }
  const reader=result.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffered=''
  for (;;) {
    let chunk:ReadableStreamReadResult<string>
    try {chunk=await reader.read()}
    catch {
      reportLocalService(false)
      throw new Error('LOCAL_SERVICE_UNAVAILABLE')
    }
    if (chunk.value) buffered+=chunk.value
    let newline=buffered.indexOf('\n')
    while (newline>=0) {
      const line=buffered.slice(0,newline).trim()
      buffered=buffered.slice(newline+1)
      newline=buffered.indexOf('\n')
      if (!line) continue
      let event:{event?:string;status?:number;body?:ServiceAnswer}&ServiceStep
      try {event=JSON.parse(line) as typeof event}
      catch {throw new Error('INVALID_SERVICE_RESPONSE')}
      if (event.event==='done') return settle<T>(event.status??500,event.body??{})
      if (event.event==='step') {
        try {onStep(event)} catch {/* progress display only */}
      }
    }
    if (chunk.done) throw new Error('INVALID_SERVICE_RESPONSE')
  }
}
