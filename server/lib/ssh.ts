/**
 * SSH connection helper using ssh2 library.
 * Programmatic SSH — no ~/.ssh/config needed.
 */

import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'

/** Configuration for connecting to a reMarkable device over SSH. */
export interface DeviceConfig {
  /** Auto-generated UUID identifying this device in the store. */
  id: string
  /** User-chosen display name for the device. */
  nickname: string
  /** IP address or hostname of the device. */
  deviceIp: string
  /** SSH port (default 22). */
  sshPort: number
  /** Authentication strategy — password auth is cleared after SSH key setup. */
  authMethod: 'password' | 'key'
  /** Device root password; cleared once SSH keys are installed. */
  sshPassword?: string
  /** Path to the private key file (e.g. `data/ssh/<deviceId>/id_remarkable`). */
  privateKeyPath?: string
  /** ISO 8601 timestamp of the last successful connection. */
  lastConnected?: string
  /** Device model string cached from test-connection (e.g. "reMarkable 2.0"). */
  deviceModel?: string
  /** Firmware version cached from test-connection. */
  firmwareVersion?: string
}

/** Result of executing a command on a remote device via SSH. */
export interface ExecResult {
  stdout: string
  stderr: string
  /** Exit code of the remote process (0 = success). */
  code: number
}

/**
 * Open an SSH connection to a reMarkable device.
 * Always connects as `root` with a 10-second ready timeout.
 * @param config - Device connection settings (IP, port, auth method).
 * @returns A connected ssh2 Client ready for exec/SFTP.
 * @throws If no authentication method is configured or the connection fails.
 */
export function connect(config: DeviceConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()

    const connectConfig: Record<string, unknown> = {
      host: config.deviceIp,
      port: config.sshPort || 22,
      username: 'root',
      readyTimeout: 10000,
      keepaliveInterval: 30000,
    }

    if (config.authMethod === 'key' && config.privateKeyPath) {
      connectConfig.privateKey = readFileSync(config.privateKeyPath)
    } else if (config.sshPassword) {
      connectConfig.password = config.sshPassword
    } else {
      reject(new Error('No authentication method configured'))
      return
    }

    client.on('ready', () => resolve(client))
    client.on('error', (err: Error) => reject(err))
    client.connect(connectConfig)
  })
}

/**
 * Execute a shell command on the remote device.
 * @param client - An already-connected ssh2 Client.
 * @param command - The shell command string to run.
 * @returns Captured stdout, stderr, and exit code.
 */
export function exec(client: Client, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) { reject(err); return }
      let stdout = ''
      let stderr = ''
      stream.on('data', (data: Buffer) => { stdout += data.toString() })
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
      stream.on('close', (code: number) => {
        resolve({ stdout, stderr, code: code ?? 0 })
      })
    })
  })
}
