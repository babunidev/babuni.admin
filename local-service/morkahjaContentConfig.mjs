import {readFile,lstat} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
import {preflightSshHost,sshKnownHostsPath,validSshHostname} from './sshHostPreflight.mjs'

const fail=code=>({ok:false,code})
const fingerprint=/^SHA256:[A-Za-z0-9+/]{43}$/
const sshUser=/^[a-z_][a-z0-9_-]{0,31}$/
const fields=['enabled','host','sshUser','sshPort','sshIdentityFile','approvedHostKeyFingerprint']

async function privateFile(path,limit=4096) {
  if(!isAbsolute(path))throw new Error('CONFIG_UNSAFE')
  const stat=await lstat(path)
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit||
    (typeof process.getuid==='function' && stat.uid!==process.getuid())||
    (stat.mode & 0o077)!==0)throw new Error('CONFIG_UNSAFE')
  return readFile(path,'utf8')
}

export async function readMorkahjaContentConfig(profile,env=process.env) {
  if(profile?.projectId!=='morkahja' || profile?.kind!=='ssh-content'||
    !validSshHostname(profile.target))return fail('REMOTE_SCOPE_DENIED')
  if(env.BABUNI_MORKAHJA_REMOTE_CONTENT!=='enabled')return fail('REMOTE_CONTENT_DISABLED')
  const path=env.BABUNI_MORKAHJA_CONTENT_CONFIG ||
    join(env.XDG_CONFIG_HOME || join(homedir(),'.config'),
      'babuni-admin','morkahja-content.json')
  let config
  try {config=JSON.parse(await privateFile(path))}
  catch {return fail('REMOTE_CONTENT_CONFIG_UNAVAILABLE')}
  if(!config||typeof config!=='object'||Array.isArray(config)||
    Object.keys(config).length!==fields.length ||
    fields.some(k=>!Object.hasOwn(config,k))||
    config.enabled!==true||config.host!==profile.target||
    !validSshHostname(config.host)||
    !sshUser.test(config.sshUser)||
    !Number.isInteger(config.sshPort)||config.sshPort<1||config.sshPort>65535||
    typeof config.sshIdentityFile!=='string'||!isAbsolute(config.sshIdentityFile)||
    !fingerprint.test(config.approvedHostKeyFingerprint)) {
    return fail('REMOTE_CONTENT_CONFIG_INVALID')
  }
  try {await privateFile(config.sshIdentityFile,65536)}
  catch {return fail('SSH_IDENTITY_UNSAFE')}
  const preflight=await preflightSshHost(profile)
  if(preflight.code!=='SSH_HOST_KEY_PINNED_OFFLINE')return fail(preflight.code)
  try {
    const file=await readFile(sshKnownHostsPath(),'utf8')
    const keys=file.split(/\r?\n/).map(row=>row.trim().split(/\s+/)).filter(row=>
      row.length>=3 && row[0]===config.host &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(row[2]))
    if(keys.length!==1)return fail('SSH_HOST_KEY_AMBIGUOUS')
    const actual='SHA256:'+createHash('sha256').update(Buffer.from(keys[0][2],'base64'))
      .digest('base64').replace(/=+$/,'')
    if(actual!==config.approvedHostKeyFingerprint)return fail('SSH_FINGERPRINT_MISMATCH')
  }catch{return fail('SSH_TRUST_STORE_UNAVAILABLE')}
  return {ok:true,config}
}
