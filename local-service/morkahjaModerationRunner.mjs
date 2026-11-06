import { readMorkahjaModerationConfig } from './morkahjaModerationConfig.mjs'
import { readCredentialForService } from './keyring.mjs'
import { startSshTunnel } from './sshTunnel.mjs'
import { queryMorkahjaModeration, validateModerationRequest } from './morkahjaModeration.mjs'

let active=false
export function isModerationActive(){return active}

export async function performMorkahjaModeration(profile,action,body,deps={}) {
  if(active)return {ok:false,code:'REMOTE_MODERATION_BUSY'}
  try {validateModerationRequest(action,body)}
  catch {return {ok:false,code:'INVALID_MODERATION_BODY'}}
  if(['timeout','ban','unban'].includes(action) &&
    (deps.writeEnabled ?? process.env.BABUNI_MORKAHJA_MODERATION_WRITES)!=='enabled')
    return {ok:false,code:'REMOTE_MODERATION_WRITE_DISABLED'}
  active=true
  let tunnel
  try {
    const approved=await (deps.readConfig||readMorkahjaModerationConfig)(profile)
    if(!approved.ok)return {ok:false,code:approved.code}
    const password=await (deps.getPassword||readCredentialForService)(profile)
    tunnel=await (deps.openTunnel||startSshTunnel)(approved.config)
    const result=await (deps.query||queryMorkahjaModeration)(
      approved.config,tunnel.socketDir,password,action,body)
    return result.ok?{ok:true,data:result.data,checkedAt:new Date().toISOString()}:
      {ok:false,code:result.code}
  } catch(error) {
    const permitted=['KEYRING_LOCKED','KEYRING_UNAVAILABLE','KEYRING_UNKNOWN',
      'KEYRING_CREDENTIAL_MISSING','SSH_SESSION_FAILED','SSH_FORWARD_TIMEOUT',
      'SSH_HOST_KEY_REJECTED','SSH_IDENTITY_UNAVAILABLE','SSH_AUTH_REJECTED',
      'SSH_FORWARD_DENIED','SSH_CLIENT_CONFIG_INVALID','SSH_HOST_UNREACHABLE']
    return {ok:false,code:permitted.includes(error?.message)?error.message:'REMOTE_MODERATION_FAILED'}
  } finally {
    try {await tunnel?.stop()}catch{}
    active=false
  }
}
