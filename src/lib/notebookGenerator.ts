/**
 * Pure functions for generating reMarkable notebook files.
 * Notebooks use the cPages v2 format with CRDT timestamps and fractional indexing.
 */

import type {
  PageGroup,
  NotebookPage,
  NotebookContent,
  NotebookMetadata,
  NotebookLocal,
  CPage,
} from '../types/notebook'
import type { TemplateRegistryEntry } from '../types/registry'
import type { DeviceId } from './renderer'

/**
 * Format a CRDT timestamp as `"replicaId:sequenceNumber"`.
 *
 * @param replicaId - The replica identifier (typically 1 for generated notebooks)
 * @param seq - The monotonically increasing sequence number
 * @returns A CRDT timestamp string (e.g. `"1:3"`)
 */
export function generateCrdtTimestamp(replicaId: number, seq: number): string {
  return `${replicaId}:${seq}`
}

/**
 * Generate a fractional index for page ordering.
 * Uses a base-26 encoding that always produces strictly ascending strings.
 *
 * The device uses simple letter sequences: "ba", "bb", ..., "bz".
 * For > 26 pages we extend the length: positions 0-25 → "baa".."baz",
 * but we keep positions 0-25 as "ba".."bz" for compatibility with device samples.
 *
 * Strategy: all indices have the same length (padded), ensuring string comparison works.
 * For <= 26 pages: 2-char ("ba".."bz")
 * For > 26 pages: encode as fixed-width base-26 strings with 'b' prefix.
 */
export function generateFractionalIndex(position: number): string {
  if (position >= 18278) {
    throw new Error(`Page position ${position} exceeds maximum supported (18,277)`)
  }
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  // Simple two-char encoding for first 26 positions
  if (position < 26) {
    return 'b' + chars[position]
  }
  // For larger positions, use 'c' prefix with base-26 digits
  // 'c' > 'bz' in string comparison, so all extended indices sort after the first 26
  const extended = position - 26
  const d1 = Math.floor(extended / 26)
  const d0 = extended % 26
  if (d1 < 26) {
    return 'c' + chars[d1] + chars[d0]
  }
  // For > 702 pages (26 + 26*26), use 'd' prefix with 3 digits
  const extended2 = position - 26 - 676
  const e2 = Math.floor(extended2 / 676)
  const e1 = Math.floor((extended2 % 676) / 26)
  const e0 = extended2 % 26
  return 'd' + chars[e2] + chars[e1] + chars[e0]
}

/**
 * Expand page groups into individual pages, assigning random UUIDs to each.
 *
 * @param groups - Page groups with a template reference and repeat count
 * @returns Flat array of individual pages
 */
export function expandPageGroups(groups: PageGroup[]): NotebookPage[] {
  const pages: NotebookPage[] = []
  for (const group of groups) {
    // Normalize any legacy full-word orientation suffixes to abbreviated form
    const templateRef = group.templateRef
      .replace(/:portrait$/, ':p')
      .replace(/:landscape$/, ':l')
    for (let i = 0; i < group.count; i++) {
      pages.push({
        id: crypto.randomUUID(),
        templateRef,
        templateName: group.templateName,
      })
    }
  }
  return pages
}

/**
 * Resolve the template reference string for a registry entry.
 * Methods templates use "uuid:orientation", classic templates use the name.
 */
export function resolveTemplateRef(entry: TemplateRegistryEntry): string {
  if (entry.rmMethodsId) {
    const orientation = entry.landscape ? 'l' : 'p'
    return `${entry.rmMethodsId}:${orientation}`
  }
  return entry.name
}

/**
 * Generate the `.metadata` file content for a new notebook.
 *
 * @param name - The visible name of the notebook
 * @returns Metadata with current timestamps and default field values
 */
export function generateNotebookMetadata(name: string): NotebookMetadata {
  const now = String(Date.now())
  return {
    createdTime: now,
    deleted: false,
    lastModified: now,
    lastOpened: now,
    lastOpenedPage: 0,
    metadatamodified: false,
    modified: false,
    new: false,
    parent: '',
    pinned: false,
    source: '',
    synced: false,
    type: 'DocumentType',
    version: 0,
    visibleName: name,
  }
}

/**
 * Generate the `.local` file content (format version marker).
 *
 * @returns A NotebookLocal object with `contentFormatVersion: 2`
 */
export function generateNotebookLocal(): NotebookLocal {
  return { contentFormatVersion: 2 }
}

/**
 * Empty .rm v6 page file for the Paper Pro Move (rmPPM).
 *
 * The PPM REQUIRES pre-deployed .rm files for each page — without them,
 * xochitl renders pages with broken zoom/dimensions. Other devices (RM1/RM2,
 * Paper Pro) create their own native .rm files on first page access and do
 * NOT need pre-deployed stubs. In fact, deploying this PPM blob to RM1
 * actively breaks rendering (causes PPM-dimension rendering on RM1).
 *
 * Captured from a device-created blank page on PPM firmware 3.26.0.68.
 */
const PPM_EMPTY_RM_BASE64 =
  'cmVNYXJrYWJsZSAubGluZXMgZmlsZSwgdmVyc2lvbj02ICAgICAgICAgIBkAAAAAAQEJ' +
  'AQwTAAAAEGlfD6tGY192nqfhOvGwxGIBAAcAAAAAAQEAHwEBIQExABkAAAAAAAEKFAEA' +
  'AAAkAAAAADQAAAAARAAAAABUAAAAAJsAAAAAAAENHAYAAAAfAAAvAAAsBQAAAB8AACEB' +
  'PAUAAAAfAAAhAVwIAAAANAMAALIFAABsKAAAAB8AACwgAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAB8EAAAAHTRRRddoolA2WSTTTbJlkCMARgAAAAfAA4sEAAA' +
  'AHTRRRddoolA2WSTTTbJlkCcAQkAAAAfAA8sAQAAAAAQAAAAAAEBAR8ACy8AADEBTAMAAADf' +
  'AAEcAAAAAAECAh8AASwKAAAAHwAALAIAAAAAATwFAAAAHwAAIQEiAAAAAAECAh8ACywQAAAA' +
  'HwAMLAgAAAAGAUNhcGEgMTwFAAAAHwAAIQEaAAAAAAEBBB8AAS8ADT8AAE8AAFQAAAAA' +
  'bAQAAAACLwAL'

/** Size in bytes of the PPM empty `.rm` stub (used to detect pristine/unedited pages). */
export const EMPTY_RM_FILE_SIZE = 423

let _ppmEmptyRmBuffer: Uint8Array | null = null

/**
 * Return an empty .rm v6 page file for the target device, or null if the
 * device creates its own .rm files and doesn't need pre-deployed stubs.
 *
 * Currently only the PPM requires pre-deployed .rm files. RM1/RM2 and
 * Paper Pro create native .rm files on first page access.
 */
export function generateEmptyRmFile(deviceId: DeviceId): Uint8Array | null {
  if (deviceId === 'rmPPM') {
    _ppmEmptyRmBuffer ??= Uint8Array.from(atob(PPM_EMPTY_RM_BASE64), c => c.charCodeAt(0))
    return _ppmEmptyRmBuffer
  }
  return null
}

/**
 * Generate the `.content` file with cPages v2 format.
 *
 * All devices share the 1404x1872 coordinate system for notebooks regardless
 * of physical display size. Device-specific dimensions are only for template rendering.
 *
 * @param pages - The expanded pages with UUIDs and template references
 * @param orientation - Page orientation (defaults to portrait)
 * @param _deviceId - Reserved for future per-device customisation
 * @returns A complete NotebookContent object ready for JSON serialisation
 */
export function generateNotebookContent(
  pages: NotebookPage[],
  orientation: 'portrait' | 'landscape' = 'portrait',
  _deviceId: DeviceId = 'rm',
): NotebookContent {
  const replicaId = 1
  let seq = 1

  // Build page entries with CRDT timestamps and fractional indices
  const cPageEntries: CPage[] = pages.map((page, i) => {
    const idxSeq = seq++
    const templateSeq = seq++
    return {
      id: page.id,
      idx: {
        timestamp: generateCrdtTimestamp(replicaId, idxSeq),
        value: generateFractionalIndex(i),
      },
      template: {
        timestamp: generateCrdtTimestamp(replicaId, templateSeq),
        value: page.templateRef,
      },
    }
  })

  const lastOpenedSeq = seq++
  const originalSeq = seq++

  // Generate a replica UUID for the uuids tracking array
  const replicaUuid = crypto.randomUUID()

  // All reMarkable devices use 1404×1872 as the notebook coordinate system,
  // regardless of physical display size. The device scales internally.
  // (Device-specific dimensions like 814×1454 are for template rendering only.)
  const isPortrait = orientation === 'portrait'
  const width = isPortrait ? 1404 : 1872
  const height = isPortrait ? 1872 : 1404

  return {
    cPages: {
      lastOpened: {
        timestamp: generateCrdtTimestamp(replicaId, lastOpenedSeq),
        value: pages.length > 0 ? pages[0].id : '',
      },
      original: {
        timestamp: generateCrdtTimestamp(0, originalSeq),
        value: -1,
      },
      pages: cPageEntries,
      uuids: [
        { first: replicaUuid, second: replicaId },
      ],
    },
    coverPageNumber: -1,
    customZoomCenterX: 0,
    customZoomCenterY: Math.floor(height / 2),
    customZoomOrientation: orientation,
    customZoomPageHeight: height,
    customZoomPageWidth: width,
    customZoomScale: 1,
    documentMetadata: {},
    extraMetadata: {},
    fileType: 'notebook',
    fontName: '',
    formatVersion: 2,
    lineHeight: -1,
    orientation,
    pageCount: pages.length,
    pageTags: [],
    sizeInBytes: '0',
    tags: [],
    textAlignment: 'justify',
    textScale: 1,
    zoomMode: 'bestFit',
  }
}
