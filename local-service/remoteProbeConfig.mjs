import { PROGRESSION_FIELDS } from './progressionMetrics.mjs'
import { readFile, lstat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { createHash } from 'node:crypto'
import { preflightSshHost, sshKnownHostsPath, validSshHostname } from './sshHostPreflight.mjs'

const namePattern=/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/
const sshUserPattern=/^[a-z_][a-z0-9_-]{0,31}$/
const fingerprintPattern=/^SHA256:[A-Za-z0-9+/]{43}$/
const keys=['enabled','host','sshUser','sshPort','sshIdentityFile','dbUser','dbName','dbPort','approvedHostKeyFingerprint']
const dataKeys=['readOnlyDataEnabled','readOnlyDataFields','readOnlyMetricFields']
const approvedFields=['displayName','avatarCount','lastPlayedAt']

function isPort(value) { return Number.isInteger(value) && value>=1 && value<=65535 }
function failed(code) { return {ok:false,code} }

export function remoteProbeConfigPath(env=process.env) {
  return env.BABUNI_MORKAHJA_PROBE_CONFIG ||
    join(env.XDG_CONFIG_HOME || join(homedir(),'.config'),'babuni-admin','morkahja-probe.json')
}

// Reads operator-owned, non-secret configuration, not data supplied by a browser.
async function privateStat(path, limit=4096) {
  if (!isAbsolute(path)) throw new Error('UNSAFE_FILE')
  const stat=await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size>limit ||
      (typeof process.getuid==='function' && stat.uid!==process.getuid()) ||
      (stat.mode & 0o077)!==0) throw new Error('UNSAFE_FILE')
  return stat
}
async function privateFile(path, limit=4096) {
  await privateStat(path,limit)
  return readFile(path,'utf8')
}

export async function readMorkahjaProbeConfig(profile,env=process.env) {
  if (profile.projectId!=='morkahja' || profile.kind!=='postgres-ssh' ||
      !validSshHostname(profile.target)) return failed('REMOTE_SCOPE_DENIED')
  // Both the process operator AND the private file must opt in. No UI endpoint enables it.
  if (env.BABUNI_MORKAHJA_REMOTE_PROBE!=='enabled') return failed('REMOTE_PROBE_DISABLED')
  let config
  try { config=JSON.parse(await privateFile(remoteProbeConfigPath(env))) }
  catch { return failed('REMOTE_CONFIG_UNAVAILABLE') }
  if (!config || Array.isArray(config) || typeof config!=='object' ||
      keys.some(key=>!Object.prototype.hasOwnProperty.call(config,key)) ||
      Object.keys(config).some(key=>!keys.includes(key) && !dataKeys.includes(key)) ||
      (config.readOnlyDataEnabled!==undefined && typeof config.readOnlyDataEnabled!=='boolean') ||
      (config.readOnlyDataFields!==undefined &&
        (!Array.isArray(config.readOnlyDataFields) ||
         JSON.stringify(config.readOnlyDataFields)!==JSON.stringify(approvedFields))) ||
      (config.readOnlyDataEnabled===true && !config.readOnlyDataFields) ||
      (config.readOnlyMetricFields!==undefined &&
        (!Array.isArray(config.readOnlyMetricFields) ||
         JSON.stringify(config.readOnlyMetricFields)!==JSON.stringify(PROGRESSION_FIELDS))) ||
      config.enabled!==true || config.host!==profile.target ||
      !validSshHostname(config.host) ||
      !sshUserPattern.test(config.sshUser) ||
      !isPort(config.sshPort) || !isPort(config.dbPort) ||
      !namePattern.test(config.dbUser) || !namePattern.test(config.dbName) ||
      !fingerprintPattern.test(config.approvedHostKeyFingerprint) ||
      typeof config.sshIdentityFile!=='string' || !isAbsolute(config.sshIdentityFile)) {
    return failed('REMOTE_CONFIG_INVALID')
  }
  try { await privateStat(config.sshIdentityFile,65536) }
  catch {return failed('SSH_IDENTITY_UNSAFE')}
  const preflight=await preflightSshHost(profile)
  if (preflight.code!=='SSH_HOST_KEY_PINNED_OFFLINE') return failed(preflight.code)
  try {
    const file=await privateFile(sshKnownHostsPath(),1024*1024)
    const pinned=file.split(/\r?\n/).map(row=>row.trim().split(/\s+/)).filter(row=>
      row.length>=3 && row[0]===config.host && /^[A-Za-z0-9+/]+={0,2}$/.test(row[2]))
    // A single exact pin prevents ambiguous host-key rotation from going unnoticed.
    if(pinned.length!==1) return failed('SSH_HOST_KEY_AMBIGUOUS')
    const actual='SHA256:'+createHash('sha256').update(Buffer.from(pinned[0][2],'base64'))
      .digest('base64').replace(/=+$/,'')
    if(actual!==config.approvedHostKeyFingerprint) return failed('SSH_FINGERPRINT_MISMATCH')
  } catch {return failed('SSH_TRUST_STORE_UNAVAILABLE')}
  return {ok:true,config}
}
