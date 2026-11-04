import { realpath, stat, readdir } from 'node:fs/promises'
import { credentialStatus } from './keyring.mjs'

export async function probeProfile(profile, previous = {}) {
  const checkedAt = new Date().toISOString()
  if (profile.kind !== 'local-files') {
    const credential = await credentialStatus(profile)
    return {
      state: 'not-configured', code: 'ADAPTER_NOT_IMPLEMENTED', credential,
      detail: credential === 'stored'
        ? 'Credential is stored in the OS keyring. This outbound adapter is not implemented.'
        : credential === 'unavailable'
          ? 'OS keyring is unavailable. This outbound adapter is not implemented.'
          : 'Outbound adapter not implemented. No remote connection attempted.',
      checkedAt, ...(previous.lastSuccessAt ? {lastSuccessAt: previous.lastSuccessAt} : {}),
    }
  }
  try {
    const canonical = await realpath(profile.target)
    const info = await stat(canonical)
    if (!info.isDirectory()) return {state:'error', code:'NOT_DIRECTORY', detail:'The configured target is not a directory.', checkedAt}
    await readdir(canonical)
    return {
      state:'available', code:'DIRECTORY_AVAILABLE',
      detail:'Local directory is readable. No remote connection or file write occurred.',
      checkedAt, lastSuccessAt:checkedAt, credential:'not-required',
    }
  } catch (error) {
    const code = error?.code === 'ENOENT' ? 'DIRECTORY_MISSING'
      : ['EACCES','EPERM'].includes(error?.code) ? 'DIRECTORY_PERMISSION_DENIED'
      : 'DIRECTORY_UNAVAILABLE'
    return {
      state:'error', code, credential:'not-required',
      detail: code === 'DIRECTORY_MISSING' ? 'Local directory does not exist.'
        : code === 'DIRECTORY_PERMISSION_DENIED' ? 'Permission denied reading the local directory.'
        : 'Local directory could not be inspected.',
      checkedAt, ...(previous.lastSuccessAt ? {lastSuccessAt: previous.lastSuccessAt} : {}),
    }
  }
}

export function inspectionState(report, previous = {}) {
  const checkedAt = new Date().toISOString()
  if (!report.ok) return {
    state:'error', code:report.error || 'INSPECTION_FAILED',
    detail:'Local content inspection failed.', checkedAt,
    ...(previous.lastSuccessAt ? {lastSuccessAt:previous.lastSuccessAt} : {}),
  }
  const success = report.files.filter(f => f.status === 'available').length
  const total = report.files.length
  const state = success === total ? 'available' : success === 0 ? 'error' : 'degraded'
  return {
    state, code:state === 'available' ? 'CONTENT_AVAILABLE'
      : state === 'degraded' ? 'CONTENT_PARTIAL' : 'CONTENT_UNAVAILABLE',
    detail:success + ' of ' + total + ' local content files inspected successfully (read-only).',
    checkedAt, ...(success === total ? {lastSuccessAt:checkedAt}
      : previous.lastSuccessAt ? {lastSuccessAt:previous.lastSuccessAt} : {}),
    credential:'not-required',
  }
}
