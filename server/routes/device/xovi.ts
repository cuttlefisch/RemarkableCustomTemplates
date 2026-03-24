/**
 * xovi extension management routes.
 *
 * POST /api/devices/:id/xovi-status          — check xovi + extension status on device
 * POST /api/devices/:id/xovi-deploy          — deploy QMD extension files
 * POST /api/devices/:id/xovi-remove          — remove QMD extension files
 * POST /api/devices/:id/vellum-install-xovi  — install xovi via Vellum
 * POST /api/devices/:id/vellum-remove-xovi   — remove xovi via Vellum
 */

import type { FastifyInstance } from 'fastify'
import type { ServerConfig } from '../../config.ts'
import { resolveDevicePaths } from '../../config.ts'
import { connect, exec } from '../../lib/ssh.ts'
import { getSftp, pushFile } from '../../lib/sftp.ts'
import { formatSshError } from '../../lib/sshErrors.ts'
import { createTrackedNdjsonStream, OperationAlreadyRunningError } from '../../lib/operationTracker.ts'
import { readDevice } from '../../lib/deviceStore.ts'
import {
  checkXoviStatus,
  listInstalledQmdFiles,
  getExtensionDefs,
  getQmdFilePath,
  mapFirmwareToQmdVersion,
  validateExclusiveGroups,
  DEVICE_PATHS,
} from '../../lib/xoviExtensions.ts'
import {
  readXoviDeployedState,
  capturePristineState,
  addDeployedExtensions,
  removeDeployedExtensions,
  writeXoviDeployedState,
  clearXoviDeployedState,
} from '../../lib/xoviDeployState.ts'

export default function deviceXoviRoutes(app: FastifyInstance, config: ServerConfig) {
  // ── POST /api/devices/:id/xovi-status ──────────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/devices/:id/xovi-status', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    let client: Awaited<ReturnType<typeof connect>> | null = null
    try {
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      const status = await checkXoviStatus(client, sftp, deviceConfig.firmwareVersion ?? null)
      const devicePaths = resolveDevicePaths(config, id)
      const tracking = readXoviDeployedState(devicePaths.xoviDeployedState)
      return reply.send({
        ok: true,
        ...status,
        tracking: tracking
          ? { pristineFiles: tracking.pristineFiles, deployedExtensionIds: tracking.deployedExtensionIds }
          : null,
      })
    } catch (err) {
      const friendly = formatSshError(err as Error)
      return reply.status(500).send({ error: friendly.message, hint: friendly.hint, rawError: friendly.rawError })
    } finally {
      client?.end()
    }
  })

  // ── POST /api/devices/:id/xovi-deploy ──────────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/devices/:id/xovi-deploy', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const body = request.body as { extensionIds?: string[] } | undefined
    const extensionIds = body?.extensionIds
    if (!Array.isArray(extensionIds) || extensionIds.length === 0) {
      return reply.status(400).send({ error: 'No extensions selected for deploy' })
    }

    // Validate extension IDs exist
    const knownIds = new Set(getExtensionDefs().map(d => d.id))
    const unknownIds = extensionIds.filter(id => !knownIds.has(id))
    if (unknownIds.length > 0) {
      return reply.status(400).send({ error: `Unknown extensions: ${unknownIds.join(', ')}` })
    }

    // Check exclusive groups
    const exclusiveErr = validateExclusiveGroups(extensionIds)
    if (exclusiveErr) {
      return reply.status(400).send({ error: exclusiveErr })
    }

    // Map firmware version to QMD version
    const fw = deviceConfig.firmwareVersion
    if (!fw) {
      return reply.status(400).send({
        error: 'Device firmware version unknown',
        hint: 'Test the device connection first to detect firmware version.',
      })
    }
    const qmdVersion = mapFirmwareToQmdVersion(fw)
    if (!qmdVersion) {
      return reply.status(400).send({
        error: `No extensions available for firmware ${fw}`,
        hint: 'Extensions may not yet support this firmware version.',
      })
    }

    // Resolve local QMD file paths (validates availability)
    const filePaths: { extensionId: string; localPath: string; filename: string }[] = []
    for (const extId of extensionIds) {
      try {
        const localPath = getQmdFilePath(extId, qmdVersion)
        const def = getExtensionDefs().find(d => d.id === extId)!
        filePaths.push({ extensionId: extId, localPath, filename: def.filename })
      } catch (err) {
        return reply.status(400).send({
          error: `Extension ${extId} not available for firmware ${fw}`,
          hint: (err as Error).message,
        })
      }
    }

    let stream
    try { stream = createTrackedNdjsonStream(reply, id, 'xovi-deploy') }
    catch (e) { if (e instanceof OperationAlreadyRunningError) return reply.status(409).send({ error: e.message, operationName: e.operationName }); throw e }
    let client: Awaited<ReturnType<typeof connect>> | null = null

    try {
      const steps: string[] = []

      // Connect
      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      const sftp = await getSftp(client)
      steps.push('Connected to device')

      // Check xovi prerequisites
      stream.progress('Checking xovi prerequisites...')
      const xoviCheck = await exec(client, `test -f ${DEVICE_PATHS.xoviSo} && echo ok || echo missing`)
      if (xoviCheck.stdout.trim() !== 'ok') {
        stream.error(
          'xovi is not installed on this device',
          'Install xovi via Vellum before deploying extensions: https://github.com/vellum-dev/vellum',
        )
        return
      }

      const qtCheck = await exec(client, `test -f ${DEVICE_PATHS.qtRebuilderSo} && echo ok || echo missing`)
      if (qtCheck.stdout.trim() !== 'ok') {
        stream.error(
          'qt-resource-rebuilder is not installed on this device',
          'Install via Vellum: the qt-resource-rebuilder package is a subpackage of xovi-extensions.',
        )
        return
      }
      steps.push('xovi prerequisites verified')

      // Ensure QMD directory exists
      await exec(client, `mkdir -p ${DEVICE_PATHS.qmdDir}`)

      // Capture pristine device state before our first deploy
      const devicePaths = resolveDevicePaths(config, id)
      const existingQmds = await listInstalledQmdFiles(sftp)
      let trackingState = capturePristineState(devicePaths.xoviDeployedState, existingQmds)

      // Deploy QMD files
      for (let i = 0; i < filePaths.length; i++) {
        const { extensionId, localPath, filename } = filePaths[i]
        stream.progress(`Deploying ${extensionId}...`, i + 1, filePaths.length)
        const remotePath = `${DEVICE_PATHS.qmdDir}/${filename}`
        await pushFile(sftp, localPath, remotePath)
        steps.push(`Deployed ${filename}`)
      }

      // Rebuild hashtable
      stream.progress('Rebuilding hashtable (this may take a minute — the device UI may restart during this process)...')
      const rebuildResult = await exec(client, DEVICE_PATHS.rebuildCmd)
      if (rebuildResult.code !== 0) {
        stream.error(
          'rebuild_hashtable failed',
          `Exit code ${rebuildResult.code}. Try running it manually: ${DEVICE_PATHS.rebuildCmd}`,
          rebuildResult.stderr,
        )
        return
      }
      steps.push('Rebuilt hashtable')

      // Update tracking state with deployed extension IDs
      trackingState = addDeployedExtensions(trackingState, extensionIds)
      writeXoviDeployedState(devicePaths.xoviDeployedState, trackingState)

      // Restart xochitl
      stream.progress('Restarting device UI (final restart)...')
      await exec(client, DEVICE_PATHS.restartCmd)
      steps.push('Restarted xochitl')

      stream.done({ steps, extensions: extensionIds, qmdVersion, log: rebuildResult.stdout })
    } catch (err) {
      const friendly = formatSshError(err as Error)
      stream.error(friendly.message, friendly.hint, friendly.rawError)
    } finally {
      client?.end()
    }
  })

  // ── POST /api/devices/:id/xovi-remove ──────────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/devices/:id/xovi-remove', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    const body = request.body as { extensionIds?: string[] } | undefined
    const extensionIds = body?.extensionIds
    if (!Array.isArray(extensionIds) || extensionIds.length === 0) {
      return reply.status(400).send({ error: 'No extensions selected for removal' })
    }

    // Validate extension IDs
    const defs = getExtensionDefs()
    const knownIds = new Set(defs.map(d => d.id))
    const unknownIds = extensionIds.filter(id => !knownIds.has(id))
    if (unknownIds.length > 0) {
      return reply.status(400).send({ error: `Unknown extensions: ${unknownIds.join(', ')}` })
    }

    let stream
    try { stream = createTrackedNdjsonStream(reply, id, 'xovi-remove') }
    catch (e) { if (e instanceof OperationAlreadyRunningError) return reply.status(409).send({ error: e.message, operationName: e.operationName }); throw e }
    let client: Awaited<ReturnType<typeof connect>> | null = null

    try {
      const steps: string[] = []
      let log = ''

      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      steps.push('Connected to device')

      // Remove QMD files
      for (let i = 0; i < extensionIds.length; i++) {
        const extId = extensionIds[i]
        const def = defs.find(d => d.id === extId)!
        const remotePath = `${DEVICE_PATHS.qmdDir}/${def.filename}`
        stream.progress(`Removing ${extId}...`, i + 1, extensionIds.length)
        // rm -f: don't fail if file doesn't exist
        await exec(client, `rm -f ${remotePath}`)
        steps.push(`Removed ${def.filename}`)
      }

      // Rebuild hashtable (if xovi is present)
      stream.progress('Rebuilding hashtable (this may take a minute — the device UI may restart during this process)...')
      const hasRebuilder = await exec(client, `test -x /home/root/xovi/rebuild_hashtable && echo ok || echo missing`)
      if (hasRebuilder.stdout.trim() === 'ok') {
        const rebuildResult = await exec(client, DEVICE_PATHS.rebuildCmd)
        if (rebuildResult.code !== 0) {
          stream.error(
            'rebuild_hashtable failed after removal',
            `Exit code ${rebuildResult.code}`,
            rebuildResult.stderr,
          )
          return
        }
        steps.push('Rebuilt hashtable')
        log = rebuildResult.stdout
      }

      // Update tracking state
      const devicePaths = resolveDevicePaths(config, id)
      const trackingState = readXoviDeployedState(devicePaths.xoviDeployedState)
      if (trackingState) {
        const updated = removeDeployedExtensions(trackingState, extensionIds)
        writeXoviDeployedState(devicePaths.xoviDeployedState, updated)
      }

      // Restart xochitl
      stream.progress('Restarting device UI...')
      await exec(client, DEVICE_PATHS.restartCmd)
      steps.push('Restarted xochitl')

      stream.done({ steps, removed: extensionIds, log })
    } catch (err) {
      const friendly = formatSshError(err as Error)
      stream.error(friendly.message, friendly.hint, friendly.rawError)
    } finally {
      client?.end()
    }
  })

  // ── POST /api/devices/:id/vellum-install-xovi ───────────────────────────────
  app.post<{ Params: { id: string } }>('/api/devices/:id/vellum-install-xovi', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    let stream
    try { stream = createTrackedNdjsonStream(reply, id, 'vellum-install-xovi') }
    catch (e) { if (e instanceof OperationAlreadyRunningError) return reply.status(409).send({ error: e.message, operationName: e.operationName }); throw e }
    let client: Awaited<ReturnType<typeof connect>> | null = null

    try {
      const steps: string[] = []

      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      steps.push('Connected to device')

      // Check vellum is installed
      stream.progress('Checking Vellum...')
      const vellumCheck = await exec(client, `test -f ${DEVICE_PATHS.vellumBin} && echo ok || echo missing`)
      if (vellumCheck.stdout.trim() !== 'ok') {
        stream.error(
          'Vellum is not installed on this device',
          'Install Vellum first: https://remarkable.guide/guide/software/vellum.html',
        )
        return
      }

      // Check reenable status — vellum add will fail if reenable is needed
      const reenableResult = await exec(client, `${DEVICE_PATHS.vellumBin} reenable status 2>/dev/null`)
      if (reenableResult.stdout.trim() === 'needed') {
        stream.error(
          'Vellum needs to be re-enabled after a firmware update',
          'SSH into your device and run: vellum reenable',
        )
        return
      }
      steps.push('Vellum ready')

      // Install all three packages explicitly for robustness
      stream.progress('Installing xovi via Vellum (downloading packages)...')
      const installResult = await exec(client, `${DEVICE_PATHS.vellumBin} add xovi xovi-extensions qt-resource-rebuilder 2>&1`)
      if (installResult.code !== 0) {
        stream.error(
          'Failed to install xovi via Vellum',
          'Check that the device has internet access and try again.',
          installResult.stdout + installResult.stderr,
        )
        return
      }
      steps.push('Installed xovi')

      stream.done({ steps, message: 'xovi installed successfully. Check status to verify.', stdout: installResult.stdout })
    } catch (err) {
      const friendly = formatSshError(err as Error)
      stream.error(friendly.message, friendly.hint, friendly.rawError)
    } finally {
      client?.end()
    }
  })

  // ── POST /api/devices/:id/vellum-remove-xovi ────────────────────────────────
  app.post<{ Params: { id: string } }>('/api/devices/:id/vellum-remove-xovi', async (request, reply) => {
    const { id } = request.params
    const deviceConfig = readDevice(config.deviceConfigPath, id)
    if (!deviceConfig) {
      return reply.status(400).send({ error: 'Device not configured' })
    }

    let stream
    try { stream = createTrackedNdjsonStream(reply, id, 'vellum-remove-xovi') }
    catch (e) { if (e instanceof OperationAlreadyRunningError) return reply.status(409).send({ error: e.message, operationName: e.operationName }); throw e }
    let client: Awaited<ReturnType<typeof connect>> | null = null

    try {
      const steps: string[] = []

      stream.progress('Connecting to device...')
      client = await connect(deviceConfig)
      steps.push('Connected to device')

      // Check vellum is installed
      const vellumCheck = await exec(client, `test -f ${DEVICE_PATHS.vellumBin} && echo ok || echo missing`)
      if (vellumCheck.stdout.trim() !== 'ok') {
        stream.error(
          'Vellum is not installed on this device',
          'Cannot remove xovi without Vellum. Remove manually via SSH if needed.',
        )
        return
      }

      // Remove any deployed QMD files first — after vellum del, rebuild_hashtable
      // won't be available, so we must clean up while xovi is still installed.
      stream.progress('Removing deployed QMD extensions...')
      const qmdClean = await exec(client, `rm -rf ${DEVICE_PATHS.qmdDir}/*.qmd 2>/dev/null; echo ok`)
      if (qmdClean.stdout.trim() === 'ok') {
        steps.push('Cleaned up QMD extensions')
      }

      // Remove all three packages explicitly — vellum del doesn't cascade to dependencies
      stream.progress('Removing xovi via Vellum...')
      const removeResult = await exec(client, `${DEVICE_PATHS.vellumBin} del qt-resource-rebuilder xovi-extensions xovi 2>&1`)
      if (removeResult.code !== 0) {
        stream.error(
          'Failed to remove xovi via Vellum',
          undefined,
          removeResult.stdout + removeResult.stderr,
        )
        return
      }
      steps.push('Removed xovi')

      // Clear tracking state — xovi is fully uninstalled
      const devicePaths = resolveDevicePaths(config, id)
      clearXoviDeployedState(devicePaths.xoviDeployedState)
      steps.push('Cleared extension tracking')

      // Restart xochitl to apply changes
      stream.progress('Restarting device UI...')
      await exec(client, DEVICE_PATHS.restartCmd)
      steps.push('Restarted xochitl')

      stream.done({ steps, message: 'xovi removed successfully.' })
    } catch (err) {
      const friendly = formatSshError(err as Error)
      stream.error(friendly.message, friendly.hint, friendly.rawError)
    } finally {
      client?.end()
    }
  })
}
