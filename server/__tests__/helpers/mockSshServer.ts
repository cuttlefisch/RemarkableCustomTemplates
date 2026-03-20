/**
 * In-process SSH/SFTP mock server for integration tests.
 *
 * Uses the ssh2 Server class to accept connections on a random port,
 * backed by a real temp directory (fsRoot) so SFTP operations hit the filesystem.
 */
import { Server, utils } from 'ssh2'
import type { Connection, Session, AuthContext } from 'ssh2'
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
  existsSync, unlinkSync, renameSync, rmdirSync, rmSync,
} from 'node:fs'
import { resolve, dirname } from 'node:path'
import { seedBaseFs } from './seedDeviceFs.ts'

const { OPEN_MODE, STATUS_CODE } = utils.sftp

export interface MockSshServer {
  port: number
  fsRoot: string
  close(): Promise<void>
  resetFs(): void
}

/** Map a remote absolute path to a local path under fsRoot. */
function mapPath(fsRoot: string, remotePath: string): string {
  // Strip leading / so resolve doesn't treat it as absolute
  const relative = remotePath.replace(/^\/+/, '')
  return resolve(fsRoot, relative)
}

export async function startMockSshServer(): Promise<MockSshServer> {
  const { tmpdir } = await import('node:os')
  const fsRoot = resolve(tmpdir(), `mock-ssh-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(fsRoot, { recursive: true })
  seedBaseFs(fsRoot)

  const hostKey = utils.generateKeyPairSync('rsa', { bits: 2048 })

  const server = new Server({ hostKeys: [hostKey.private] }, (client: Connection) => {
    client.on('authentication', (ctx: AuthContext) => {
      // Accept any auth
      ctx.accept()
    })

    client.on('ready', () => {
      client.on('session', (accept: () => Session) => {
        const session = accept()

        session.on('exec', (accept: (arg?: boolean) => NodeJS.WritableStream & { exit: (code: number) => void; stderr: { write: (data: string) => void } }, _reject: () => void, info: { command: string }) => {
          const channel = accept()
          handleExec(fsRoot, info.command, channel)
        })

        session.on('sftp', (accept: () => SftpStream) => {
          const sftp = accept()
          handleSftp(fsRoot, sftp)
        })
      })
    })
  })

  return new Promise((resolvePromise, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'))
        return
      }
      resolvePromise({
        port: addr.port,
        fsRoot,
        close: () => new Promise<void>((res) => {
          server.close(() => res())
        }),
        resetFs: () => {
          try {
            rmSync(fsRoot, { recursive: true, force: true })
          } catch { /* best effort */ }
          mkdirSync(fsRoot, { recursive: true })
          seedBaseFs(fsRoot)
        },
      })
    })

    server.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Exec handler — pattern-match commands and return canned responses
// ---------------------------------------------------------------------------

function handleExec(
  fsRoot: string,
  command: string,
  channel: NodeJS.WritableStream & { exit: (code: number) => void; stderr: { write: (data: string) => void } },
) {
  try {
    if (command.includes('cat /sys/devices/soc0/machine')) {
      const localPath = mapPath(fsRoot, '/sys/devices/soc0/machine')
      const content = existsSync(localPath) ? readFileSync(localPath, 'utf8') : ''
      channel.write(content)
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('IMG_VERSION') && command.includes('/etc/os-release')) {
      const localPath = mapPath(fsRoot, '/etc/os-release')
      if (existsSync(localPath)) {
        const content = readFileSync(localPath, 'utf8')
        const match = content.match(/IMG_VERSION="?([^"\n]+)"?/)
        if (match) {
          channel.write(match[1].trim())
          channel.exit(0)
          channel.end()
          return
        }
      }
      channel.write('')
      channel.exit(1)
      channel.end()
      return
    }

    if (command.includes('grep -rl') && command.includes('TemplateType')) {
      // Scan for .metadata files containing TemplateType
      const xochitlDir = mapPath(fsRoot, '/home/root/.local/share/remarkable/xochitl')
      const results: string[] = []
      if (existsSync(xochitlDir)) {
        for (const file of readdirSync(xochitlDir)) {
          if (file.endsWith('.metadata')) {
            const content = readFileSync(resolve(xochitlDir, file), 'utf8')
            if (content.includes('"TemplateType"')) {
              results.push(`/home/root/.local/share/remarkable/xochitl/${file}`)
            }
          }
        }
      }
      channel.write(results.join('\n') + (results.length ? '\n' : ''))
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('ls -t') && command.includes('template-backups')) {
      const backupsDir = mapPath(fsRoot, '/home/root/template-backups')
      if (existsSync(backupsDir)) {
        const files = readdirSync(backupsDir)
          .filter(f => f.startsWith('templates_') && f.endsWith('.tar.gz'))
          .sort()
          .reverse()
        if (files.length > 0) {
          channel.write(files.map(f => `/home/root/template-backups/${f}`).join('\n') + '\n')
          channel.exit(0)
          channel.end()
          return
        }
      }
      channel.write('NO_BACKUPS\n')
      channel.exit(1)
      channel.end()
      return
    }

    if (command.includes('systemctl restart xochitl')) {
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('mount -o remount')) {
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('mkdir -p') && command.includes('.ssh')) {
      const sshDir = mapPath(fsRoot, '/home/root/.ssh')
      mkdirSync(sshDir, { recursive: true })
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('grep -qF') && command.includes('authorized_keys')) {
      // Extract the key from the command and append to authorized_keys
      const sshDir = mapPath(fsRoot, '/home/root/.ssh')
      mkdirSync(sshDir, { recursive: true })
      const authKeysPath = resolve(sshDir, 'authorized_keys')
      // Extract public key from the echo part of the command
      const echoMatch = command.match(/echo '([^']+)'/)
      if (echoMatch) {
        const existingContent = existsSync(authKeysPath) ? readFileSync(authKeysPath, 'utf8') : ''
        if (!existingContent.includes(echoMatch[1])) {
          writeFileSync(authKeysPath, existingContent + echoMatch[1] + '\n')
        }
      }
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('chmod')) {
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('tar czf')) {
      // Touch the backup file
      const tarMatch = command.match(/tar czf ([^\s]+)/)
      if (tarMatch) {
        const tarPath = mapPath(fsRoot, tarMatch[1])
        mkdirSync(dirname(tarPath), { recursive: true })
        writeFileSync(tarPath, 'fake-tar-content')
      }
      channel.exit(0)
      channel.end()
      return
    }

    if (command.includes('tar xzf')) {
      channel.exit(0)
      channel.end()
      return
    }

    // Default: succeed silently
    channel.exit(0)
    channel.end()
  } catch {
    channel.exit(1)
    channel.end()
  }
}

// ---------------------------------------------------------------------------
// SFTP handler — maps all operations to the local fsRoot
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type SftpStream = any

function handleSftp(fsRoot: string, sftp: SftpStream) {
  const openFiles = new Map<number, { path: string; flags: number; offset: number }>()
  const openDirs = new Map<number, { path: string; listed: boolean }>()
  let handleCount = 0

  function allocHandle(): Buffer {
    const handle = Buffer.alloc(4)
    handle.writeUInt32BE(handleCount++)
    return handle
  }

  function getHandleId(handle: Buffer): number {
    if (handle.length !== 4) return -1
    return handle.readUInt32BE(0)
  }

  sftp.on('OPEN', (reqid: number, filename: string, flags: number, _attrs: any) => {
    const localPath = mapPath(fsRoot, filename)

    try {
      if (flags & OPEN_MODE.WRITE || flags & OPEN_MODE.CREAT) {
        // Writing — ensure parent dir exists
        mkdirSync(dirname(localPath), { recursive: true })
        if (flags & OPEN_MODE.TRUNC) {
          writeFileSync(localPath, '')
        } else if (!existsSync(localPath)) {
          writeFileSync(localPath, '')
        }
      } else {
        // Reading — file must exist
        if (!existsSync(localPath)) {
          return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
        }
      }
    } catch {
      return sftp.status(reqid, STATUS_CODE.FAILURE)
    }

    const handle = allocHandle()
    openFiles.set(getHandleId(handle), { path: localPath, flags, offset: 0 })
    sftp.handle(reqid, handle)
  })

  sftp.on('READ', (reqid: number, handle: Buffer, offset: number, length: number) => {
    const id = getHandleId(handle)
    const file = openFiles.get(id)
    if (!file) return sftp.status(reqid, STATUS_CODE.FAILURE)

    try {
      const data = readFileSync(file.path)
      if (offset >= data.length) {
        return sftp.status(reqid, STATUS_CODE.EOF)
      }
      const chunk = data.subarray(offset, offset + length)
      sftp.data(reqid, chunk)
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE)
    }
  })

  sftp.on('WRITE', (reqid: number, handle: Buffer, offset: number, data: Buffer) => {
    const id = getHandleId(handle)
    const file = openFiles.get(id)
    if (!file) return sftp.status(reqid, STATUS_CODE.FAILURE)

    try {
      // Read existing content, expand if needed, write at offset
      let existing = Buffer.alloc(0)
      try { existing = readFileSync(file.path) } catch { /* new file */ }

      const needed = offset + data.length
      const buf = Buffer.alloc(Math.max(existing.length, needed))
      existing.copy(buf)
      data.copy(buf, offset)
      writeFileSync(file.path, buf)
      sftp.status(reqid, STATUS_CODE.OK)
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE)
    }
  })

  sftp.on('CLOSE', (reqid: number, handle: Buffer) => {
    const id = getHandleId(handle)
    openFiles.delete(id)
    openDirs.delete(id)
    sftp.status(reqid, STATUS_CODE.OK)
  })

  sftp.on('FSTAT', (reqid: number, handle: Buffer) => {
    const id = getHandleId(handle)
    const file = openFiles.get(id)
    if (!file) return sftp.status(reqid, STATUS_CODE.FAILURE)

    try {
      const stat = statSync(file.path)
      sftp.attrs(reqid, {
        mode: stat.mode,
        uid: stat.uid,
        gid: stat.gid,
        size: stat.size,
        atime: Math.floor(stat.atimeMs / 1000),
        mtime: Math.floor(stat.mtimeMs / 1000),
      })
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
    }
  })

  sftp.on('STAT', (reqid: number, path: string) => {
    const localPath = mapPath(fsRoot, path)
    try {
      const stat = statSync(localPath)
      sftp.attrs(reqid, {
        mode: stat.mode,
        uid: stat.uid,
        gid: stat.gid,
        size: stat.size,
        atime: Math.floor(stat.atimeMs / 1000),
        mtime: Math.floor(stat.mtimeMs / 1000),
      })
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
    }
  })

  sftp.on('LSTAT', (reqid: number, path: string) => {
    const localPath = mapPath(fsRoot, path)
    try {
      const stat = statSync(localPath)
      sftp.attrs(reqid, {
        mode: stat.mode,
        uid: stat.uid,
        gid: stat.gid,
        size: stat.size,
        atime: Math.floor(stat.atimeMs / 1000),
        mtime: Math.floor(stat.mtimeMs / 1000),
      })
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
    }
  })

  sftp.on('OPENDIR', (reqid: number, path: string) => {
    const localPath = mapPath(fsRoot, path)
    if (!existsSync(localPath)) {
      return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
    }
    const handle = allocHandle()
    openDirs.set(getHandleId(handle), { path: localPath, listed: false })
    sftp.handle(reqid, handle)
  })

  sftp.on('READDIR', (reqid: number, handle: Buffer) => {
    const id = getHandleId(handle)
    const dir = openDirs.get(id)
    if (!dir) return sftp.status(reqid, STATUS_CODE.FAILURE)

    if (dir.listed) {
      return sftp.status(reqid, STATUS_CODE.EOF)
    }
    dir.listed = true

    try {
      const entries = readdirSync(dir.path)
      const names = entries.map(name => {
        const fullPath = resolve(dir.path, name)
        let stat
        try { stat = statSync(fullPath) } catch { stat = null }
        return {
          filename: name,
          longname: name,
          attrs: stat ? {
            mode: stat.mode,
            uid: stat.uid,
            gid: stat.gid,
            size: stat.size,
            atime: Math.floor(stat.atimeMs / 1000),
            mtime: Math.floor(stat.mtimeMs / 1000),
          } : {},
        }
      })
      sftp.name(reqid, names)
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE)
    }
  })

  sftp.on('REMOVE', (reqid: number, path: string) => {
    const localPath = mapPath(fsRoot, path)
    try {
      unlinkSync(localPath)
      sftp.status(reqid, STATUS_CODE.OK)
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE)
    }
  })

  sftp.on('REALPATH', (reqid: number, path: string) => {
    // Just normalize the path — no symlink resolution needed in tests
    const normalized = path === '.' ? '/' : path
    sftp.name(reqid, [{ filename: normalized, longname: normalized, attrs: {} }])
  })

  sftp.on('MKDIR', (reqid: number, path: string, _attrs: any) => {
    const localPath = mapPath(fsRoot, path)
    try {
      mkdirSync(localPath, { recursive: true })
      sftp.status(reqid, STATUS_CODE.OK)
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE)
    }
  })

  sftp.on('RENAME', (reqid: number, oldPath: string, newPath: string) => {
    try {
      renameSync(mapPath(fsRoot, oldPath), mapPath(fsRoot, newPath))
      sftp.status(reqid, STATUS_CODE.OK)
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE)
    }
  })

  sftp.on('RMDIR', (reqid: number, path: string) => {
    try {
      rmdirSync(mapPath(fsRoot, path))
      sftp.status(reqid, STATUS_CODE.OK)
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE)
    }
  })
}
