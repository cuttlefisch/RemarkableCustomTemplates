/**
 * Device configuration and SSH key management routes.
 *
 * GET  /api/device/config          — read config (password redacted)
 * POST /api/device/config          — save/update config
 * POST /api/device/test-connection — test SSH connectivity
 * POST /api/device/setup-keys      — generate keys, copy to device
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateKeyPairSync } from 'node:crypto'
import ssh2 from 'ssh2'
import type { ServerConfig } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'

function readDeviceConfig(config: ServerConfig): DeviceConfig | null {
  try {
    return JSON.parse(readFileSync(config.deviceConfigPath, 'utf8')) as DeviceConfig
  } catch {
    return null
  }
}

function writeDeviceConfig(config: ServerConfig, deviceConfig: DeviceConfig): void {
  mkdirSync(resolve(config.deviceConfigPath, '..'), { recursive: true })
  writeFileSync(config.deviceConfigPath, JSON.stringify(deviceConfig, null, 2), 'utf8')
}

export default function deviceConfigRoutes(app: FastifyInstance, config: ServerConfig) {
  // GET /api/device/config
  app.get('/api/device/config', async (_request, reply) => {
    const deviceConfig = readDeviceConfig(config)
    if (!deviceConfig) {
      return reply.send({ configured: false })
    }
    // Redact password
    const redacted = { ...deviceConfig, sshPassword: deviceConfig.sshPassword ? '***' : undefined }
    return reply.send({ configured: true, config: redacted })
  })

  // POST /api/device/config
  app.post('/api/device/config', async (request, reply) => {
    try {
      const body = request.body as Partial<DeviceConfig>
      const existing = readDeviceConfig(config) ?? {
        deviceIp: '',
        sshPort: 22,
        authMethod: 'password' as const,
      }
      const updated: DeviceConfig = {
        ...existing,
        ...body,
        sshPort: body.sshPort ?? existing.sshPort ?? 22,
      }
      writeDeviceConfig(config, updated)
      return reply.send({ ok: true })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // POST /api/device/test-connection
  app.post('/api/device/test-connection', async (request, reply) => {
    try {
      // Allow testing with override config (e.g. during setup wizard)
      const bodyConfig = request.body as Partial<DeviceConfig> | undefined
      const savedConfig = readDeviceConfig(config)
      const deviceConfig: DeviceConfig = {
        deviceIp: bodyConfig?.deviceIp ?? savedConfig?.deviceIp ?? '',
        sshPort: bodyConfig?.sshPort ?? savedConfig?.sshPort ?? 22,
        authMethod: bodyConfig?.authMethod ?? savedConfig?.authMethod ?? 'password',
        sshPassword: bodyConfig?.sshPassword ?? savedConfig?.sshPassword,
        privateKeyPath: bodyConfig?.privateKeyPath ?? savedConfig?.privateKeyPath,
      }

      if (!deviceConfig.deviceIp) {
        return reply.status(400).send({ error: 'No device IP configured' })
      }

      const client = await connect(deviceConfig)
      const result = await exec(client, 'cat /sys/devices/soc0/machine')
      client.end()

      const now = new Date().toISOString()
      const saved = readDeviceConfig(config)
      if (saved) {
        saved.lastConnected = now
        writeDeviceConfig(config, saved)
      }

      return reply.send({
        ok: true,
        deviceModel: result.stdout.trim(),
        lastConnected: now,
      })
    } catch (e) {
      return reply.status(500).send({ error: `Connection failed: ${String(e)}` })
    }
  })

  // POST /api/device/setup-keys
  app.post('/api/device/setup-keys', async (_request, reply) => {
    try {
      const deviceConfig = readDeviceConfig(config)
      if (!deviceConfig) {
        return reply.status(400).send({ error: 'Device not configured. Save config first.' })
      }

      // Generate RSA key pair
      mkdirSync(config.sshDir, { recursive: true })
      const privateKeyPath = resolve(config.sshDir, 'id_remarkable')
      const publicKeyPath = resolve(config.sshDir, 'id_remarkable.pub')

      // Generate key pair: OpenSSH format for ssh2 compatibility
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      })

      // ssh2 needs PKCS#1 (RSA PRIVATE KEY) format — PKCS#8 is not supported
      writeFileSync(privateKeyPath, privateKey, { mode: 0o600 })

      // Use ssh2's parser to extract OpenSSH-format public key for authorized_keys
      const parsed = ssh2.utils.parseKey(privateKey)
      if (parsed instanceof Error) throw parsed
      const pubBlob = (parsed as { getPublicSSH: () => Buffer }).getPublicSSH()
      const opensshPubStr = `ssh-rsa ${pubBlob.toString('base64')} remarkable-templates`
      writeFileSync(publicKeyPath, opensshPubStr + '\n')

      // Connect with current auth (password) and install the public key
      const client = await connect(deviceConfig)
      const escapedPubKey = opensshPubStr.replace(/'/g, "'\\''")

      // reMarkable uses /home/root as root's home directory, not /root
      await exec(client, `mkdir -p /home/root/.ssh && chmod 700 /home/root/.ssh`)
      await exec(client, `grep -qF '${escapedPubKey}' /home/root/.ssh/authorized_keys 2>/dev/null || echo '${escapedPubKey}' >> /home/root/.ssh/authorized_keys`)
      await exec(client, `chmod 600 /home/root/.ssh/authorized_keys`)
      client.end()

      // Update config to use key auth
      deviceConfig.authMethod = 'key'
      deviceConfig.privateKeyPath = privateKeyPath
      delete deviceConfig.sshPassword
      writeDeviceConfig(config, deviceConfig)

      return reply.send({ ok: true, message: 'SSH keys generated and installed. Switched to key authentication.' })
    } catch (e) {
      return reply.status(500).send({ error: `Key setup failed: ${String(e)}` })
    }
  })
}
