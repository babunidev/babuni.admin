#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto'
import { credentialStatus, storeCredential, verifyCredential, clearCredential } from '../local-service/keyring.mjs'

// The profile and random value exist only for this one command, never in connections.json.
const profile={id:randomUUID(),kind:'github'}
const secret=randomBytes(32).toString('hex')
let attempted=false
let result=1
try {
  const missing=await credentialStatus(profile)
  if (missing==='unavailable') throw new Error('KEYRING_UNAVAILABLE')
  if (missing!=='missing') throw new Error('TEST_PROFILE_COLLISION')
  attempted=true
  await storeCredential(profile,secret)
  if (await credentialStatus(profile)!=='stored') throw new Error('STORE_NOT_CONFIRMED')
  if (!await verifyCredential(profile,secret)) throw new Error('RETRIEVAL_MISMATCH')
  result=0
  console.log('Linux Secret Service round-trip verified: ephemeral store and retrieve.')
} catch(error) {
  console.error('Local keyring verification failed:',error?.message||'KEYRING_UNAVAILABLE')
} finally {
  if (attempted) {
    try {
      await clearCredential(profile)
      if (await credentialStatus(profile)!=='missing') throw new Error('CLEANUP_NOT_CONFIRMED')
      console.log('Ephemeral test secret removed from the keyring.')
    } catch {
      console.error('Warning: could not verify cleanup of the ephemeral test keyring item.')
      result=1
    }
  }
}
process.exitCode=result
