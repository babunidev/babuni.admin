import {
  closeSync, copyFileSync, existsSync, fsyncSync, lstatSync,
  openSync, renameSync, unlinkSync, writeFileSync, constants,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join } from 'node:path'

/**
 * Writes to a same-directory temporary file, fsyncs it, optionally preserves
 * the previous version in a uniquely named backup, then renames it into place.
 * A failure before rename leaves the prior file intact.
 * Backups are retained for operator-managed recovery, not auto-pruned.
 */
export function writeFileWithBackup(filePath: string, data: string | Buffer): string | null {
  const directory = dirname(filePath)
  const temp = join(directory, '.' + basename(filePath) + '.' + randomUUID() + '.tmp')
  let backup: string | null = null
  let fileDescriptor: number | null = null
  try {
    if (existsSync(filePath) && lstatSync(filePath).isSymbolicLink()) {
      throw new Error('SYMLINK_TARGET_NOT_ALLOWED')
    }
    fileDescriptor = openSync(temp, 'wx', 0o600)
    writeFileSync(fileDescriptor, data)
    fsyncSync(fileDescriptor)
    closeSync(fileDescriptor)
    fileDescriptor = null
    if (existsSync(filePath)) {
      backup = filePath + '.bak-' + Date.now() + '-' + randomUUID()
      copyFileSync(filePath, backup, constants.COPYFILE_EXCL)
    }
    renameSync(temp, filePath)
    return backup
  } finally {
    if (fileDescriptor !== null) closeSync(fileDescriptor)
    if (existsSync(temp)) unlinkSync(temp)
  }
}

/** Replaces the target with a preserved prior version, retaining a backup of
 * the version being replaced. Intended for explicit, offline operator recovery. */
export function restoreBackup(filePath: string, backupPath: string): string | null {
  if (!backupPath.startsWith(filePath + '.bak-') || !existsSync(backupPath)) {
    throw new Error('INVALID_BACKUP_PATH')
  }
  return writeFileWithBackup(filePath, requireBackupContents(backupPath))
}

import { readFileSync } from 'node:fs'
function requireBackupContents(path: string): Buffer {
  if (lstatSync(path).isSymbolicLink()) throw new Error('SYMLINK_BACKUP_NOT_ALLOWED')
  return readFileSync(path)
}
