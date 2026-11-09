import { localConnectionApi } from '../../../shared/services/localConnectionClient'

export interface PublishFile { file: string; changed: boolean }
export interface PublishResult {
  ok: boolean
  apply: boolean
  files: PublishFile[]
  liveRelease: string | null
  newRelease: string | null
  published: boolean
  nothing: boolean
  error?: string
}

export const listDocuments = () =>
  localConnectionApi<{ documents: string[] }>('GET', '/portfolio/documents')
export const checkDocument = (path: string) =>
  localConnectionApi<PublishResult>('POST', '/portfolio/document-check', { path })
export const publishDocument = (path: string) =>
  localConnectionApi<PublishResult>('POST', '/portfolio/document-publish', { path })

const MESSAGES: Record<string, string> = {
  SSH_KEY_NOT_LOADED: 'The deployment key is not loaded. Run ssh-add ~/.ssh/id_ed25519_babuni_deploy in a terminal, then retry.',
  CHECKOUT_UNAVAILABLE: 'The babuni.dev checkout could not be read on this computer.',
  PUBLISH_BUSY: 'Another publish is running. Wait for it to finish.',
  PUBLISH_FAILED: 'The publish script failed. Nothing was switched on the live site.',
  PUBLISH_TIMEOUT: 'The publish script took too long and was stopped.',
  DOCUMENT_PATH_DENIED: 'That document is not on the allowed list.',
  LOCAL_SERVICE_UNAVAILABLE: 'The local service is not running.',
}
export const describeError = (code: string) => MESSAGES[code] ?? 'Unexpected failure: ' + code
