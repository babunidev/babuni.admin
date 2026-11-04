import { probeProfile } from './connectionHealth.mjs'
import { hasCapability } from '../vite/connectionAdapters.ts'

// A read-only local-files session is ephemeral: no file handles, secrets or tunnels are held.
export async function connectLocal(profile,previous={}) {
  if (!hasCapability(profile,'local:connect')) return {ok:false,error:'ADAPTER_NOT_IMPLEMENTED'}
  const probe=await probeProfile(profile,previous)
  if (probe.state!=='available') return {ok:false,status:probe}
  return {ok:true,status:{...probe,state:'connected',code:'LOCAL_READ_ONLY_CONNECTED',
    detail:'Read-only local directory session active. No files opened for writing.'}}
}

export function disconnectLocal(profile) {
  if (!hasCapability(profile,'local:connect')) return {ok:false,error:'ADAPTER_NOT_IMPLEMENTED'}
  return {ok:true,status:{
    state:'disconnected',code:'DISCONNECTED',
    detail:'Local read-only session ended. No background reconnection is scheduled.',
    checkedAt:new Date().toISOString(),credential:'not-required',
  }}
}
