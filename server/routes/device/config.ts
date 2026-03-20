/**
 * Device CRUD and SSH key management routes.
 *
 * GET    /api/devices                    — list all devices (passwords redacted)
 * POST   /api/devices                    — add a new device
 * PUT    /api/devices/:id                — update a device
 * DELETE /api/devices/:id                — remove a device + cleanup
 * POST   /api/devices/:id/test-connection — test SSH connectivity
 * POST   /api/devices/:id/setup-keys     — generate keys, copy to device
 * GET    /api/devices/active             — get active device ID
 * POST   /api/devices/active             — set active device ID
 */

import type { FastifyInstance } from 'fastify'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, generateKeyPairSync } from 'node:crypto'
import ssh2 from 'ssh2'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { connect, exec, type DeviceConfig } from '../../lib/ssh.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import {
  readDeviceStore,
  writeDevice,
  readDevice,
  removeDevice,
  getActiveDevice,
  setActiveDevice,
} from '../../lib/deviceStore.ts'

/** Redact password from a device config for API responses. */
function redact(device: DeviceConfig): Record<string, unknown> {
  return { ...device, sshPassword: device.sshPassword ? '***' : undefined }
}

export default function deviceConfigRoutes(app: FastifyInstance, config: ServerConfig) {
  // GET /api/devices — list all devices
  app.get('/api/devices', async (_request, reply) => {
    const store = readDeviceStore(config.deviceConfigPath)
    return reply.send({
      devices: store.devices.map(redact),
      activeDeviceId: store.activeDeviceId,
    })
  })

  // POST /api/devices — add a new device
  app.post('/api/devices', async (request, reply) => {
    try {
      const body = request.body as Partial<DeviceConfig>
      const device: DeviceConfig = {
        id: randomUUID(),
        nickname: body.nickname ?? 'My reMarkable',
        deviceIp: body.deviceIp ?? '',
        sshPort: body.sshPort ?? 22,
        authMethod: body.authMethod ?? 'password',
        sshPassword: body.sshPassword,
        privateKeyPath: body.privateKeyPath,
        lastConnected: body.lastConnected,
        deviceModel: body.deviceModel,
        firmwareVersion: body.firmwareVersion,
      }
      writeDevice(config.deviceConfigPath, device)

      // If this is the first device, make it active
      const store = readDeviceStore(config.deviceConfigPath)
      if (store.devices.length === 1) {
        setActiveDevice(config.deviceConfigPath, device.id)
      }

      return reply.status(201).send({ device: redact(device) })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // PUT /api/devices/:id — update a device
  app.put<{ Params: { id: string } }>('/api/devices/:id', async (request, reply) => {
    const { id } = request.params
    const existing = readDevice(config.deviceConfigPath, id)
    if (!existing) {
      return reply.status(404).send({ error: 'Device not found' })
    }

    try {
      const body = request.body as Partial<DeviceConfig>
      const updated: DeviceConfig = {
        ...existing,
        ...body,
        id, // prevent ID mutation
        sshPort: body.sshPort ?? existing.sshPort ?? 22,
      }
      writeDevice(config.deviceConfigPath, updated)
      return reply.send(redact(updated))
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // DELETE /api/devices/:id — remove a device + cleanup per-device dirs
  app.delete<{ Params: { id: string } }>('/api/devices/:id', async (request, reply) => {
    const { id } = request.params
    const existing = readDevice(config.deviceConfigPath, id)
    if (!existing) {
      return reply.status(404).send({ error: 'Device not found' })
    }

    removeDevice(config.deviceConfigPath, id)

    // Cleanup per-device directories
    const paths = resolveDevicePaths(config, id)
    try { rmSync(paths.backupDir, { recursive: true, force: true }) } catch { /* best effort */ }
    try { rmSync(paths.sshDir, { recursive: true, force: true }) } catch { /* best effort */ }

    return reply.send({ ok: true })
  })

  // GET /api/devices/active — get active device
  app.get('/api/devices/active', async (_request, reply) => {
    const device = getActiveDevice(config.deviceConfigPath)
    if (!device) {
      return reply.send({ activeDeviceId: null })
    }
    return reply.send({ activeDeviceId: device.id, device: redact(device) })
  })

  // POST /api/devices/active — set active device
  app.post('/api/devices/active', async (request, reply) => {
    try {
      const { deviceId } = request.body as { deviceId: string }
      setActiveDevice(config.deviceConfigPath, deviceId)
      return reply.send({ ok: true, activeDeviceId: deviceId })
    } catch (e) {
      return reply.status(400).send({ error: String(e) })
    }
  })

  // POST /api/devices/:id/test-connection
  app.post<{ Params: { id: string } }>('/api/devices/:id/test-connection', async (request, reply) => {
    try {
      const { id } = request.params
      const bodyConfig = request.body as Partial<DeviceConfig> | undefined
      const savedConfig = readDevice(config.deviceConfigPath, id)

      const deviceConfig: DeviceConfig = {
        id,
        nickname: savedConfig?.nickname ?? 'My reMarkable',
        deviceIp: bodyConfig?.deviceIp ?? savedConfig?.deviceIp ?? '',
        sshPort: bodyConfig?.sshPort ?? savedConfig?.sshPort ?? 22,
        authMethod: bodyConfig?.authMethod ?? savedConfig?.authMethod ?? 'password',
        sshPassword: bodyConfig?.sshPassword ?? savedConfig?.sshPassword,
        privateKeyPath: bodyConfig?.privateKeyPath ?? savedConfig?.privateKeyPath,
      }

      if (!deviceConfig.deviceIp) {
        return reply.status(400).send({ error: 'No device IP configured' })
      }

      let client: Awaited<ReturnType<typeof connect>> | null = null
      try {
        client = await connect(deviceConfig)
        const [modelResult, fwResult] = await Promise.all([
          exec(client, 'cat /sys/devices/soc0/machine'),
          exec(client, 'grep REMARKABLE_RELEASE_VERSION /etc/os-release | cut -d= -f2'),
        ])

        const now = new Date().toISOString()
        const deviceModel = modelResult.stdout.trim()
        const firmwareVersion = fwResult.stdout.trim() || undefined

        // Update cached info on the saved device
        if (savedConfig) {
          savedConfig.lastConnected = now
          savedConfig.deviceModel = deviceModel
          savedConfig.firmwareVersion = firmwareVersion
          writeDevice(config.deviceConfigPath, savedConfig)
        }

        return reply.send({
          ok: true,
          deviceModel,
          firmwareVersion,
          lastConnected: now,
        })
      } finally {
        client?.end()
      }
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Connection failed: ${formatted.message}`, hint: formatted.hint, rawError: formatted.rawError })
    }
  })

  // POST /api/devices/:id/setup-keys
  app.post<{ Params: { id: string } }>('/api/devices/:id/setup-keys', async (request, reply) => {
    try {
      const { id } = request.params
      const deviceConfig = readDevice(config.deviceConfigPath, id)
      if (!deviceConfig) {
        return reply.status(400).send({ error: 'Device not found. Add the device first.' })
      }

      // Generate RSA key pair in per-device SSH dir
      const paths = resolveDevicePaths(config, id)
      mkdirSync(paths.sshDir, { recursive: true })
      const privateKeyPath = resolve(paths.sshDir, 'id_remarkable')

      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      })

      writeFileSync(privateKeyPath, privateKey, { mode: 0o600 })

      // Use ssh2's parser to extract OpenSSH-format public key
      const parsed = ssh2.utils.parseKey(privateKey)
      if (parsed instanceof Error) throw parsed
      const pubBlob = (parsed as { getPublicSSH: () => Buffer }).getPublicSSH()
      const opensshPubStr = `ssh-rsa ${pubBlob.toString('base64')} remarkable-templates`
      writeFileSync(resolve(paths.sshDir, 'id_remarkable.pub'), opensshPubStr + '\n')

      // Connect with current auth (password) and install the public key
      let client: Awaited<ReturnType<typeof connect>> | null = null
      try {
        client = await connect(deviceConfig)
        const escapedPubKey = opensshPubStr.replace(/'/g, "'\\''")

        await exec(client, `mkdir -p /home/root/.ssh && chmod 700 /home/root/.ssh`)
        await exec(client, `grep -qF '${escapedPubKey}' /home/root/.ssh/authorized_keys 2>/dev/null || echo '${escapedPubKey}' >> /home/root/.ssh/authorized_keys`)
        await exec(client, `chmod 600 /home/root/.ssh/authorized_keys`)
      } finally {
        client?.end()
      }

      // Update config to use key auth
      deviceConfig.authMethod = 'key'
      deviceConfig.privateKeyPath = privateKeyPath
      delete deviceConfig.sshPassword
      writeDevice(config.deviceConfigPath, deviceConfig)

      return reply.send({ ok: true, message: 'SSH keys generated and installed. Switched to key authentication.' })
    } catch (e) {
      const formatted = formatSshError(e instanceof Error ? e : String(e))
      return reply.status(500).send({ error: `Key setup failed: ${formatted.message}`, hint: formatted.hint, rawError: formatted.rawError })
    }
  })
}
