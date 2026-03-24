/**
 * SFTP file transfer helpers. Replaces rsync/scp with programmatic ssh2 SFTP.
 */

import type { Client, SFTPWrapper } from 'ssh2'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

/** Callback invoked during multi-file transfers to report progress. */
export type ProgressCallback = (current: number, total: number) => void

/**
 * Open an SFTP session from an established SSH connection.
 * @param client - A connected ssh2 Client.
 * @returns An SFTPWrapper for file transfer operations.
 */
export function getSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) reject(err)
      else resolve(sftp)
    })
  })
}

/**
 * List filenames in a remote directory.
 * @param sftp - An active SFTP session.
 * @param remotePath - Absolute path to the remote directory.
 * @returns Array of filenames (not full paths).
 */
export function listRemoteDir(sftp: SFTPWrapper, remotePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) reject(err)
      else resolve(list.map(entry => entry.filename))
    })
  })
}

/**
 * Download a single file from the device to the local filesystem.
 * Creates parent directories on the local side if needed.
 * @param sftp - An active SFTP session.
 * @param remotePath - Absolute path on the device.
 * @param localPath - Destination path on the local filesystem.
 */
export function pullFile(sftp: SFTPWrapper, remotePath: string, localPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(localPath), { recursive: true })
    sftp.fastGet(remotePath, localPath, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * Upload a single file from the local filesystem to the device.
 * @param sftp - An active SFTP session.
 * @param localPath - Source path on the local filesystem.
 * @param remotePath - Destination path on the device.
 */
export function pushFile(sftp: SFTPWrapper, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/**
 * Download all files from a remote directory to a local path.
 * @param sftp - An active SFTP session.
 * @param remotePath - Absolute path to the remote directory.
 * @param localPath - Local destination directory (created if missing).
 * @param filter - Optional predicate to include only matching filenames.
 * @param onProgress - Optional callback invoked after each file is pulled.
 * @returns Array of filenames that were successfully downloaded.
 */
export async function pullDirectory(
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string,
  filter?: (filename: string) => boolean,
  onProgress?: ProgressCallback,
): Promise<string[]> {
  mkdirSync(localPath, { recursive: true })
  const files = await listRemoteDir(sftp, remotePath)
  const filtered = filter ? files.filter(filter) : files
  const pulled: string[] = []

  for (const file of filtered) {
    const remoteFile = `${remotePath}/${file}`
    const localFile = resolve(localPath, file)
    await pullFile(sftp, remoteFile, localFile)
    pulled.push(file)
    onProgress?.(pulled.length, filtered.length)
  }

  return pulled
}

/**
 * Upload all files from a local directory to a remote path.
 * Only regular files are uploaded (subdirectories are skipped).
 * @param sftp - An active SFTP session.
 * @param localPath - Local source directory.
 * @param remotePath - Absolute path to the remote destination directory.
 * @param filter - Optional predicate to include only matching filenames.
 * @param onProgress - Optional callback invoked after each file is pushed.
 * @returns Array of filenames that were successfully uploaded.
 */
export async function pushDirectory(
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  filter?: (filename: string) => boolean,
  onProgress?: ProgressCallback,
): Promise<string[]> {
  const files = readdirSync(localPath)
  const eligible = files.filter(file => {
    if (filter && !filter(file)) return false
    const localFile = resolve(localPath, file)
    return statSync(localFile).isFile()
  })
  const pushed: string[] = []

  for (const file of eligible) {
    const localFile = resolve(localPath, file)
    const remoteFile = `${remotePath}/${file}`
    await pushFile(sftp, localFile, remoteFile)
    pushed.push(file)
    onProgress?.(pushed.length, eligible.length)
  }

  return pushed
}

/**
 * Download a specific list of files from a remote directory.
 * Files that don't exist on the device are silently skipped with a warning.
 * @param sftp - An active SFTP session.
 * @param remoteDir - Absolute path to the remote directory containing the files.
 * @param filenames - List of filenames to download.
 * @param localDir - Local destination directory (created if missing).
 * @param onProgress - Optional callback invoked after each file attempt (including skips).
 * @returns Array of filenames that were successfully downloaded.
 */
export async function pullFiles(
  sftp: SFTPWrapper,
  remoteDir: string,
  filenames: string[],
  localDir: string,
  onProgress?: ProgressCallback,
): Promise<string[]> {
  mkdirSync(localDir, { recursive: true })
  const pulled: string[] = []
  let processed = 0

  for (const filename of filenames) {
    try {
      await pullFile(sftp, `${remoteDir}/${filename}`, resolve(localDir, filename))
      pulled.push(filename)
    } catch (err) {
      // Skip files that don't exist on device
      console.warn(`[sftp-pull] Skipping "${filename}": ${err instanceof Error ? err.message : String(err)}`)
    }
    processed++
    onProgress?.(processed, filenames.length)
  }

  return pulled
}

/**
 * Delete specific files from a remote directory.
 * Files that don't exist on the device are silently skipped with a warning.
 * @param sftp - An active SFTP session.
 * @param remoteDir - Absolute path to the remote directory containing the files.
 * @param filenames - List of filenames to remove.
 * @param onProgress - Optional callback invoked after each file attempt (including skips).
 * @returns Array of filenames that were successfully removed.
 */
export async function removeFiles(
  sftp: SFTPWrapper,
  remoteDir: string,
  filenames: string[],
  onProgress?: ProgressCallback,
): Promise<string[]> {
  const removed: string[] = []
  let processed = 0

  for (const filename of filenames) {
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(`${remoteDir}/${filename}`, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      removed.push(filename)
    } catch (err) {
      // Skip files that don't exist on device
      console.warn(`[sftp-remove] Skipping "${filename}": ${err instanceof Error ? err.message : String(err)}`)
    }
    processed++
    onProgress?.(processed, filenames.length)
  }

  return removed
}

/**
 * Read a remote file's contents as a UTF-8 string.
 * @param sftp - An active SFTP session.
 * @param remotePath - Absolute path to the file on the device.
 * @returns The file contents as a string.
 */
export function readRemoteFile(sftp: SFTPWrapper, remotePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    const stream = sftp.createReadStream(remotePath, { encoding: 'utf8' })
    stream.on('data', (chunk: string) => { data += chunk })
    stream.on('end', () => resolve(data))
    stream.on('error', reject)
  })
}

/**
 * Write a UTF-8 string to a remote file, replacing its contents.
 * @param sftp - An active SFTP session.
 * @param remotePath - Absolute path to the file on the device.
 * @param content - The string content to write.
 */
export function writeRemoteFile(sftp: SFTPWrapper, remotePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(remotePath, { encoding: 'utf8' })
    stream.on('close', () => resolve())
    stream.on('error', reject)
    stream.end(content)
  })
}
