#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { defaultCollectionLockState, credentialStatus, keyringHealth } from '../local-service/keyring.mjs'

const mode=process.argv[2]
const probe={id:randomUUID(),kind:'github'}

async function inspect() {
  // Only inspect the default collection Locked property and a never-used ID.
  const lockState=await defaultCollectionLockState()
  console.log('Default Secret Service collection:',lockState)
  if (lockState==='unknown') {
    // Do not call secret-tool: some providers would show an unlock prompt.
    console.log('Lock introspection unsupported; skipped credential lookup to avoid an unlock prompt.')
    return
  }
  const health=await keyringHealth()
  const credential=await credentialStatus(probe)
  console.log('Keyring health:',health)
  console.log('Nonexistent test-profile credential:',credential)
  if(lockState==='locked') {
    if(health!=='locked'||credential!=='locked') throw new Error('LOCKED_KEYRING_NOT_DENIED')
    console.log('Real locked-keyring detection verified without unlocking.')
  } else console.log('Collection is unlocked. Locked-keyring verification remains pending.')
}
function isolatedProbe(env) {
  return new Promise((resolve,reject)=>{
    let output=''
    const child=spawn(process.execPath,[new URL(import.meta.url).pathname,'isolated-probe'],{
      env,stdio:['ignore','pipe','ignore'],shell:false,
    })
    let finished=false
    const timeout=setTimeout(()=>child.kill('SIGKILL'),10000)
    child.stdout.on('data',part=>{output+=part.toString('utf8').slice(0,512-output.length)})
    child.on('error',()=>{
      if(!finished){finished=true;clearTimeout(timeout);reject(new Error('ISOLATED_PROBE_FAILED'))}
    })
    child.on('close',(code,signal)=>{
      if(finished)return
      finished=true
      clearTimeout(timeout)
      if(signal||code!==0)reject(new Error('ISOLATED_PROBE_FAILED'))
      else resolve(output.trim())
    })
  })
}
async function verifyUnavailable() {
  if(await keyringHealth()!=='available') throw new Error('UNLOCKED_BASELINE_REQUIRED')
  const env={...process.env,
    DBUS_SESSION_BUS_ADDRESS:'unix:path=/tmp/babuni-no-secret-service-'+randomUUID(),
  }
  delete env.BABUNI_SECRET_TOOL_BIN
  delete env.BABUNI_BUSCTL_BIN
  const outcome=await isolatedProbe(env)
  if(outcome!=='unavailable/unavailable') throw new Error('FAIL_CLOSED_CHECK_FAILED')
  console.log('Real Secret Service unavailable-bus behavior verified in isolated process.')
  console.log('Existing desktop keyring and stored credentials were not modified.')
}
try {
  if(mode==='inspect') await inspect()
  else if(mode==='unavailable') await verifyUnavailable()
  else if(mode==='isolated-probe') {
    const [health,credential]=await Promise.all([keyringHealth(),credentialStatus(probe)])
    process.stdout.write(health+'/'+credential)
  } else throw new Error('USE_INSPECT_OR_UNAVAILABLE')
} catch(error) {
  console.error('Keyring condition check failed:',error?.message||'UNKNOWN')
  process.exitCode=1
}
