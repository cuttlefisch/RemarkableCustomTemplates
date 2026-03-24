/**
 * xovi extension management — version mapping, extension definitions,
 * device status checking, and validation.
 *
 * Pure logic (except checkXoviStatus which uses SSH/SFTP).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Client } from 'ssh2'
import type { SFTPWrapper } from 'ssh2'
import { exec } from './ssh.ts'

// ── paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_XOVI_DATA_DIR = resolve(__dirname, '../data/xovi-extensions')

/** Resolved xovi extensions data directory. Set via {@link setXoviDataDir}. */
export let XOVI_DATA_DIR = DEFAULT_XOVI_DATA_DIR

/**
 * Override the xovi extensions data directory.
 * Called from app.ts when ServerConfig.xoviDataDir is set (e.g. Electron).
 */
export function setXoviDataDir(dir: string): void {
  XOVI_DATA_DIR = dir
  _resetManifestCache()
}

/** Device-side paths */
export const DEVICE_PATHS = {
  xoviSo: '/home/root/xovi/xovi.so',
  qtRebuilderSo: '/home/root/xovi/extensions.d/qt-resource-rebuilder.so',
  qmdDir: '/home/root/xovi/exthome/qt-resource-rebuilder',
  rebuildCmd: 'cd /home/root && echo | ./xovi/rebuild_hashtable',
  restartCmd: 'systemctl restart xochitl',
  vellumBin: '/home/root/.vellum/bin/vellum',
} as const

// ── types ────────────────────────────────────────────────────────────────────

export interface XoviExtensionDef {
  id: string
  filename: string
  displayName: string
  description: string
  tier: 1 | 2
  category: string
  exclusiveGroup?: string
}

export interface XoviExtensionStatus extends XoviExtensionDef {
  installed: boolean
  available: boolean
}

export interface XoviDeviceStatus {
  xoviInstalled: boolean
  qtRebuilderInstalled: boolean
  extensions: XoviExtensionStatus[]
  firmwareVersion: string | null
  qmdVersion: string | null
  vellumInstalled: boolean
  vellumVersion: string | null
  vellumReenableNeeded: boolean
  /** QMD filenames on device that don't match any known extension */
  unknownFiles: string[]
}

interface Manifest {
  extensions: Record<string, Omit<XoviExtensionDef, 'id'>>
  checksums: Record<string, string>
  supportedVersions: string[]
}

// ── manifest ─────────────────────────────────────────────────────────────────

let _manifest: Manifest | null = null

function loadManifest(): Manifest {
  if (_manifest) return _manifest
  const raw = readFileSync(resolve(XOVI_DATA_DIR, 'manifest.json'), 'utf-8')
  _manifest = JSON.parse(raw) as Manifest
  return _manifest
}

/** For testing: clear the cached manifest so it reloads from disk. */
export function _resetManifestCache(): void {
  _manifest = null
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Map a firmware version string (e.g. "3.26.1.2") to a QMD version directory
 * (e.g. "3.26"). Returns null if no matching QMD version exists.
 */
export function mapFirmwareToQmdVersion(firmwareVersion: string): string | null {
  const parts = firmwareVersion.split('.')
  if (parts.length < 2) return null
  const candidate = `${parts[0]}.${parts[1]}`
  const manifest = loadManifest()
  return manifest.supportedVersions.includes(candidate) ? candidate : null
}

/** Return all extension definitions from the manifest. */
export function getExtensionDefs(): XoviExtensionDef[] {
  const manifest = loadManifest()
  return Object.entries(manifest.extensions).map(([id, def]) => ({ id, ...def }))
}

/** Return the set of supported firmware versions. */
export function getSupportedVersions(): string[] {
  return loadManifest().supportedVersions
}

/**
 * Resolve the local filesystem path for a QMD file.
 * Throws if the extension or version is unknown, or the file doesn't exist.
 */
export function getQmdFilePath(extensionId: string, qmdVersion: string): string {
  const manifest = loadManifest()
  const def = manifest.extensions[extensionId]
  if (!def) throw new Error(`Unknown extension: ${extensionId}`)
  if (!manifest.supportedVersions.includes(qmdVersion)) {
    throw new Error(`Unsupported QMD version: ${qmdVersion}`)
  }
  const filePath = resolve(XOVI_DATA_DIR, qmdVersion, def.filename)
  if (!existsSync(filePath)) {
    throw new Error(`QMD file not found: ${qmdVersion}/${def.filename}`)
  }
  return filePath
}

/**
 * Validate that no mutually-exclusive extensions are both selected.
 * Returns an error message string if there's a conflict, or null if OK.
 */
export function validateExclusiveGroups(extensionIds: string[]): string | null {
  const defs = getExtensionDefs()
  const groups = new Map<string, string[]>()

  for (const id of extensionIds) {
    const def = defs.find(d => d.id === id)
    if (!def) return `Unknown extension: ${id}`
    if (def.exclusiveGroup) {
      const existing = groups.get(def.exclusiveGroup) ?? []
      existing.push(id)
      groups.set(def.exclusiveGroup, existing)
    }
  }

  for (const [group, ids] of groups) {
    if (ids.length > 1) {
      return `Extensions ${ids.join(' and ')} are mutually exclusive (${group} group)`
    }
  }

  return null
}

/**
 * List `.qmd` filenames in the device's QMD directory via SFTP.
 * Returns an empty array if the directory doesn't exist or can't be read.
 */
export async function listInstalledQmdFiles(sftp: SFTPWrapper): Promise<string[]> {
  try {
    const entries = await new Promise<string[]>((resolve, reject) => {
      sftp.readdir(DEVICE_PATHS.qmdDir, (err, list) => {
        if (err) {
          if ((err as NodeJS.ErrnoException).code === '2' || err.message.includes('No such file')) {
            resolve([])
          } else {
            reject(err)
          }
        } else {
          resolve(list.map(e => e.filename))
        }
      })
    })
    return entries.filter(name => name.endsWith('.qmd'))
  } catch {
    return []
  }
}

/**
 * Split installed QMD filenames into known (matching a manifest extension) and unknown.
 * Pure function — no SSH/SFTP dependency.
 */
export function classifyQmdFiles(
  installedFiles: string[],
  knownDefs: XoviExtensionDef[],
): { known: string[]; unknown: string[] } {
  const knownFilenames = new Set(knownDefs.map(d => d.filename))
  const known: string[] = []
  const unknown: string[] = []
  for (const f of installedFiles) {
    if (knownFilenames.has(f)) known.push(f)
    else unknown.push(f)
  }
  return { known: known.sort(), unknown: unknown.sort() }
}

/**
 * Check xovi installation status on a connected device.
 * Requires an active SSH client and SFTP session.
 */
export async function checkXoviStatus(
  client: Client,
  sftp: SFTPWrapper,
  firmwareVersion: string | null,
): Promise<XoviDeviceStatus> {
  // Check xovi core, qt-resource-rebuilder, and vellum in parallel
  const [xoviResult, qtResult, vellumResult, vellumReenableResult] = await Promise.all([
    exec(client, `test -f ${DEVICE_PATHS.xoviSo} && echo ok || echo missing`),
    exec(client, `test -f ${DEVICE_PATHS.qtRebuilderSo} && echo ok || echo missing`),
    exec(client, `test -f ${DEVICE_PATHS.vellumBin} && ${DEVICE_PATHS.vellumBin} --version 2>/dev/null || echo missing`),
    exec(client, `test -f ${DEVICE_PATHS.vellumBin} && ${DEVICE_PATHS.vellumBin} reenable status 2>/dev/null || echo missing`),
  ])

  const xoviInstalled = xoviResult.stdout.trim() === 'ok'
  const qtRebuilderInstalled = qtResult.stdout.trim() === 'ok'

  const vellumOut = vellumResult.stdout.trim()
  const vellumInstalled = vellumOut !== 'missing' && vellumOut !== ''
  const vellumVersion = vellumInstalled ? vellumOut : null

  const reenableOut = vellumReenableResult.stdout.trim()
  const vellumReenableNeeded = vellumInstalled && reenableOut === 'needed'

  // List installed QMD files
  const installedFilesList = qtRebuilderInstalled ? await listInstalledQmdFiles(sftp) : []
  const installedFiles = new Set(installedFilesList)

  const qmdVersion = firmwareVersion ? mapFirmwareToQmdVersion(firmwareVersion) : null
  const defs = getExtensionDefs()
  const { unknown: unknownFiles } = classifyQmdFiles(installedFilesList, defs)

  const extensions: XoviExtensionStatus[] = defs.map(def => {
    let available = false
    if (qmdVersion) {
      try {
        getQmdFilePath(def.id, qmdVersion)
        available = true
      } catch {
        available = false
      }
    }
    return {
      ...def,
      installed: installedFiles.has(def.filename),
      available,
    }
  })

  return {
    xoviInstalled,
    qtRebuilderInstalled,
    extensions,
    firmwareVersion,
    qmdVersion,
    vellumInstalled,
    vellumVersion,
    vellumReenableNeeded,
    unknownFiles,
  }
}
