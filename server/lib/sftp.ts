/**
 * SFTP file transfer helpers. Replaces rsync/scp with programmatic ssh2 SFTP.
 */

import type { Client, SFTPWrapper } from 'ssh2'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

/** Get an SFTP session from an SSH client. */
export function getSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) reject(err)
      else resolve(sftp)
    })
  })
}

/** List files in a remote directory. */
export function listRemoteDir(sftp: SFTPWrapper, remotePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (err, list) => {
      if (err) reject(err)
      else resolve(list.map(entry => entry.filename))
    })
  })
}

/** Download a single file from remote to local. */
export function pullFile(sftp: SFTPWrapper, remotePath: string, localPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(localPath), { recursive: true })
    sftp.fastGet(remotePath, localPath, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/** Upload a single file from local to remote. */
export function pushFile(sftp: SFTPWrapper, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

/** Recursively download a remote directory to a local path. */
export async function pullDirectory(
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string,
  filter?: (filename: string) => boolean,
): Promise<string[]> {
  mkdirSync(localPath, { recursive: true })
  const files = await listRemoteDir(sftp, remotePath)
  const pulled: string[] = []

  for (const file of files) {
    if (filter && !filter(file)) continue
    const remoteFile = `${remotePath}/${file}`
    const localFile = resolve(localPath, file)
    await pullFile(sftp, remoteFile, localFile)
    pulled.push(file)
  }

  return pulled
}

/** Recursively upload a local directory to a remote path. */
export async function pushDirectory(
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  filter?: (filename: string) => boolean,
): Promise<string[]> {
  const files = readdirSync(localPath)
  const pushed: string[] = []

  for (const file of files) {
    if (filter && !filter(file)) continue
    const localFile = resolve(localPath, file)
    const stat = statSync(localFile)
    if (!stat.isFile()) continue
    const remoteFile = `${remotePath}/${file}`
    await pushFile(sftp, localFile, remoteFile)
    pushed.push(file)
  }

  return pushed
}

/** Download specific files from a remote directory. */
export async function pullFiles(
  sftp: SFTPWrapper,
  remoteDir: string,
  filenames: string[],
  localDir: string,
): Promise<string[]> {
  mkdirSync(localDir, { recursive: true })
  const pulled: string[] = []

  for (const filename of filenames) {
    try {
      await pullFile(sftp, `${remoteDir}/${filename}`, resolve(localDir, filename))
      pulled.push(filename)
    } catch {
      // Skip files that don't exist
    }
  }

  return pulled
}

/** Remove specific files from a remote directory. */
export async function removeFiles(
  sftp: SFTPWrapper,
  remoteDir: string,
  filenames: string[],
): Promise<string[]> {
  const removed: string[] = []

  for (const filename of filenames) {
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(`${remoteDir}/${filename}`, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      removed.push(filename)
    } catch {
      // Skip files that don't exist
    }
  }

  return removed
}

/** Read a remote file's contents as a string. */
export function readRemoteFile(sftp: SFTPWrapper, remotePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    const stream = sftp.createReadStream(remotePath, { encoding: 'utf8' })
    stream.on('data', (chunk: string) => { data += chunk })
    stream.on('end', () => resolve(data))
    stream.on('error', reject)
  })
}

/** Write a string to a remote file. */
export function writeRemoteFile(sftp: SFTPWrapper, remotePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(remotePath, { encoding: 'utf8' })
    stream.on('close', () => resolve())
    stream.on('error', reject)
    stream.end(content)
  })
}
