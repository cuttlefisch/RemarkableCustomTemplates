/**
 * SSH connection helper using ssh2 library.
 * Programmatic SSH — no ~/.ssh/config needed.
 */

import { Client } from 'ssh2'
import { readFileSync } from 'node:fs'

export interface DeviceConfig {
  id: string                     // auto-generated UUID
  nickname: string               // user-chosen display name
  deviceIp: string
  sshPort: number                // default 22
  authMethod: 'password' | 'key'
  sshPassword?: string           // cleared after key setup
  privateKeyPath?: string        // data/ssh/<deviceId>/id_remarkable
  lastConnected?: string         // ISO timestamp
  deviceModel?: string           // cached from test-connection
  firmwareVersion?: string       // cached from test-connection
}

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

/** Connect to a device using the given config. */
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

/** Execute a command on the remote device. */
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
