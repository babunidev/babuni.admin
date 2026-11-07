import {useSyncExternalStore} from 'react'

export interface MorkahjaImageCacheStatus {
  phase: 'idle'|'syncing'|'ready'|'failed'
  cached: number
  verified: number
  downloaded: number
  count: number
  updatedAt: string|null
  error: string|null
  generation: number
}
const empty:MorkahjaImageCacheStatus={
  phase:'idle',cached:0,verified:0,downloaded:0,count:0,
  updatedAt:null,error:null,generation:0,
}
let current=empty
const listeners=new Set<()=>void>()
function subscribe(cb:()=>void){
  listeners.add(cb)
  return ()=>{listeners.delete(cb)}
}
function snapshot(){return current}
export function publishMorkahjaImageCacheStatus(next:MorkahjaImageCacheStatus) {
  if(JSON.stringify(next)===JSON.stringify(current))return
  current=next
  for(const listener of listeners)listener()
}
export function useMorkahjaImageCacheStatus() {
  return useSyncExternalStore(subscribe,snapshot,snapshot)
}
