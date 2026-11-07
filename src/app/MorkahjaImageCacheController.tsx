import {useEffect} from 'react'
import {localConnectionApi} from '../shared/services/localConnectionClient'
import {resolveMorkahjaConnection} from '../shared/services/morkahjaConnection'
import {
  publishMorkahjaImageCacheStatus,
  type MorkahjaImageCacheStatus,
} from '../shared/services/morkahjaImageCacheStatus'

// Mounted once while the Morkahja workspace is active, rather than per Content
// tab. The service stores every downloaded image on the operator's computer.
export function MorkahjaImageCacheController() {
  useEffect(()=>{
    let cancelled=false
    let pollTimer:ReturnType<typeof setInterval>|undefined
    let syncTimer:ReturnType<typeof setInterval>|undefined
    async function initialize() {
      try {
        const {profiles}=await localConnectionApi<{profiles:Array<{
          id:string;projectId:string;kind:string;displayName:string;target?:string
        }>}>()
        const selected=resolveMorkahjaConnection(profiles)
        if(cancelled||!selected)return
        const path='/'+selected.id
        async function refresh() {
          try {
            const result=await localConnectionApi<MorkahjaImageCacheStatus>(
              'GET',path+'/content-image-status')
            if(!cancelled)publishMorkahjaImageCacheStatus(result)
          }catch { /* The cached pictures remain usable while offline. */ }
        }
        async function sync() {
          try {
            await localConnectionApi('POST',path+'/content-image-sync')
            await refresh()
          }catch { /* A failed sync never discards the local cache. */ }
        }
        await sync()
        if(cancelled)return
        pollTimer=setInterval(()=>{void refresh()},3000)
        syncTimer=setInterval(()=>{void sync()},10*60*1000)
      }catch { /* The administrator may be unconfigured or offline. */ }
    }
    void initialize()
    return ()=>{
      cancelled=true
      if(pollTimer)clearInterval(pollTimer)
      if(syncTimer)clearInterval(syncTimer)
    }
  },[])
  return null
}
