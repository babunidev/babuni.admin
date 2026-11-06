import { homedir } from 'node:os'
import { join } from 'node:path'
import { readMorkahjaProbeConfig } from './remoteProbeConfig.mjs'

const fail = code => ({ok:false,code})

// A second owner-private config and credential. The existing Overview login is
// never promoted to a writer; this check reuses the exact SSH host pin and
// identity validation, but has a distinct operator opt-in.
export async function readMorkahjaModerationConfig(profile, env=process.env) {
  if(profile?.projectId!=='morkahja' || profile?.kind!=='postgres-ssh-moderation') {
    return fail('REMOTE_SCOPE_DENIED')
  }
  if(env.BABUNI_MORKAHJA_REMOTE_MODERATION!=='enabled') {
    return fail('REMOTE_MODERATION_DISABLED')
  }
  const path=env.BABUNI_MORKAHJA_MODERATION_CONFIG ||
    join(env.XDG_CONFIG_HOME || join(homedir(),'.config'),
      'babuni-admin','morkahja-moderation.json')
  const result=await readMorkahjaProbeConfig(
    {...profile,kind:'postgres-ssh'},
    {...env,BABUNI_MORKAHJA_REMOTE_PROBE:'enabled',BABUNI_MORKAHJA_PROBE_CONFIG:path}
  )
  if(!result.ok)return result
  const config=result.config
  if(config.dbUser==='babuni_admin_probe' || config.readOnlyDataEnabled===true ||
      config.readOnlyMetricFields!==undefined || config.readOnlyDataFields!==undefined) {
    return fail('REMOTE_MODERATION_CONFIG_INVALID')
  }
  return result
}
