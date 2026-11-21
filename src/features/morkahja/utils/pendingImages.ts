import type { ImageUploadReport, RemoteImageKind } from '../services/contentApi'

/** An image chosen in an editor, uploaded only when the record is saved. */
export interface PendingUpload {
  kind: RemoteImageKind
  /** Uploads it; returns the live report, or nothing for local-file mode. */
  run: () => Promise<ImageUploadReport | undefined>
}

/** An image upload failed during a save; the record itself was not saved. */
export class ImageUploadError extends Error {
  readonly kind: RemoteImageKind
  readonly failure: Error
  /** Images uploaded before the failing one. */
  readonly reports: ImageUploadReport[]
  constructor(kind: RemoteImageKind, failure: Error, reports: ImageUploadReport[]) {
    super(failure.message)
    this.kind = kind
    this.failure = failure
    this.reports = reports
  }
}

/** Upload one after another, stopping at the first failure. */
export async function runUploads(uploads: PendingUpload[]): Promise<ImageUploadReport[]> {
  const reports: ImageUploadReport[] = []
  for (const upload of uploads) {
    try {
      const report = await upload.run()
      if (report) reports.push(report)
    } catch (error) {
      throw new ImageUploadError(
        upload.kind,
        error instanceof Error ? error : new Error('IMAGE_WRITE_FAILED'),
        reports,
      )
    }
  }
  return reports
}

/** The record failed to save after its chosen images were uploaded. */
export class RecordSaveError extends Error {
  readonly failure: Error
  readonly reports: ImageUploadReport[]
  constructor(failure: Error, reports: ImageUploadReport[]) {
    super(failure.message)
    this.failure = failure
    this.reports = reports
  }
}

/** Save the record; when that fails, keep the images already uploaded with the error. */
export async function saveAfterUploads<R>(reports: ImageUploadReport[], save: () => Promise<R>): Promise<R> {
  try { return await save() }
  catch (error) {
    if (reports.length === 0) throw error
    throw new RecordSaveError(error instanceof Error ? error : new Error('CONTENT_OPERATION_FAILED'), reports)
  }
}
