import { spawn } from 'node:child_process'
import { readFile, lstat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

// Stage-one SSH trust check. Never connects, changes a trust store, or accepts a key.
const hostnamePattern = /^(?=.{1,120}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
const keyTypes = new Set(['ssh-ed25519', 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'])

function plausiblePublicKey(type, encoded) {
  if (!keyTypes.has(type) || typeof encoded !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length<40) return false
  const bytes=Buffer.from(encoded,'base64')
  if (bytes.length<8) return false
  const declared=bytes.readUInt32BE(0)
  return declared===Buffer.byteLength(type) && bytes.length>4+declared &&
    bytes.subarray(4,4+declared).toString('utf8')===type
}

export function validSshHostname(host) {
  return typeof host === 'string' && hostnamePattern.test(host) && !['localhost','0.0.0.0'].includes(host.toLowerCase())
}

export function sshKnownHostsPath() {
  // An operator-controlled, project-specific trust store. Never auto-populate it
  // from untrusted ssh-keyscan output or the application's browser.
  return process.env.BABUNI_SSH_KNOWN_HOSTS ||
    join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),'babuni-admin','ssh_known_hosts')
}

function result(code, detail, checkedAt) {
  return {state:'not-configured',code,detail,checkedAt}
}

async function findWithOpenSsh(host, file) {
  return await new Promise(resolve => {
    const child=spawn(process.env.BABUNI_SSH_KEYGEN_BIN || 'ssh-keygen',
      ['-F',host,'-f',file],{shell:false,stdio:['ignore','ignore','ignore']})
    let finished=false
    const timeout=setTimeout(()=>child.kill('SIGKILL'),3000)
    child.on('error',()=>{if(!finished){finished=true;clearTimeout(timeout);resolve(false)}})
    child.on('close',(code,signal)=>{
      if(finished)return
      finished=true
      clearTimeout(timeout)
      resolve(!signal && code===0)
    })
  })
}

export async function preflightSshHost(profile) {
  const checkedAt=new Date().toISOString()
  if (profile.projectId!=='morkahja' || profile.kind!=='postgres-ssh') {
    return result('ADAPTER_NOT_IMPLEMENTED','SSH trust inspection not allowed for this project.',checkedAt)
  }
  if (!validSshHostname(profile.target)) {
    return result('SSH_HOST_INVALID','SSH host name is not permitted.',checkedAt)
  }
  const file=sshKnownHostsPath()
  if (!isAbsolute(file)) return result('SSH_TRUST_STORE_UNSAFE','SSH trust store must have an absolute path.',checkedAt)
  try {
    const stat=await lstat(file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size>1024*1024 ||
        (typeof process.getuid==='function' && stat.uid!==process.getuid()) ||
        (stat.mode & 0o022)!==0) {
      return result('SSH_TRUST_STORE_UNSAFE','SSH trust store is not a privately controlled regular file.',checkedAt)
    }
    const data=await readFile(file,'utf8')
    // Only an exact, explicit hostname is accepted: no wildcard, host list,
    // certificate authority, negated or implicit hashed key entry.
    const entry=data.split(/\r?\n/).some(line=>{
      const tokens=line.trim().split(/\s+/)
      return tokens.length>=3 && tokens[0]===profile.target &&
        plausiblePublicKey(tokens[1],tokens[2])
    })
    if (!entry) return result('SSH_HOST_NOT_PINNED','No exact host-key entry in the dedicated trust store; no connection attempted.',checkedAt)
    if (!await findWithOpenSsh(profile.target,file)) {
      return result('SSH_HOST_KEY_INVALID','OpenSSH did not accept the configured host-key entry.',checkedAt)
    }
    return result('SSH_HOST_KEY_PINNED_OFFLINE',
      'Explicit SSH host key found locally. Its fingerprint must be verified independently; no SSH or database connection was attempted.',checkedAt)
  } catch(error) {
    return result(error?.code==='ENOENT'?'SSH_TRUST_STORE_MISSING':'SSH_TRUST_STORE_UNAVAILABLE',
      'Dedicated SSH trust store cannot be read; no connection attempted.',checkedAt)
  }
}
