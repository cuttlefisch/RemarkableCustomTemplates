/**
 * Generate manifest.json for bundled xovi extension QMD files.
 * Walks server/data/xovi-extensions/<version>/ directories, computes SHA-512
 * checksums, and writes the manifest with extension metadata.
 *
 * Usage: npx tsx scripts/generate-xovi-manifest.ts
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XOVI_DATA_DIR = resolve(__dirname, '../server/data/xovi-extensions')

const EXTENSION_DEFS = {
  unlockMethodsContent: {
    filename: 'unlockMethodsContent.qmd',
    displayName: 'Unlock Methods Content',
    description: 'Bypasses subscription check for using on-device Methods templates and documents.',
    tier: 1,
    category: 'essential',
  },
  createPagesRM2Size: {
    filename: 'createPagesRM2Size.qmd',
    displayName: 'Create Pages (RM2 Size)',
    description: 'Forces new pages to use reMarkable 2 dimensions (1404\u00d71872) for cross-device consistency.',
    tier: 1,
    category: 'page-size',
    exclusiveGroup: 'pageSize',
  },
  createPagesPaperProSize: {
    filename: 'createPagesPaperProSize.qmd',
    displayName: 'Create Pages (Paper Pro Size)',
    description: 'Forces new pages to use Paper Pro dimensions (1620\u00d72160) for cross-device consistency.',
    tier: 1,
    category: 'page-size',
    exclusiveGroup: 'pageSize',
  },
  preventNotebookZoomOut: {
    filename: 'preventNotebookZoomOut.qmd',
    displayName: 'Prevent Notebook Zoom Out',
    description: 'Forces notebook pages to start at 1x zoom. Designed for Paper Pro Move.',
    tier: 1,
    category: 'essential',
  },
  quicksheetUseTemplate: {
    filename: 'quicksheetUseTemplate.qmd',
    displayName: 'Quicksheet Use Template',
    description: 'New quicksheet pages use the same template as the previous page in the notebook.',
    tier: 2,
    category: 'recommended',
  },
}

function sha512(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha512').update(content).digest('hex')
}

// Discover version directories
const versions = readdirSync(XOVI_DATA_DIR)
  .filter(d => /^\d+\.\d+$/.test(d) && statSync(resolve(XOVI_DATA_DIR, d)).isDirectory())
  .sort((a, b) => {
    const [aMaj, aMin] = a.split('.').map(Number)
    const [bMaj, bMin] = b.split('.').map(Number)
    return aMaj - bMaj || aMin - bMin
  })

// Compute checksums
const checksums: Record<string, string> = {}
for (const version of versions) {
  const versionDir = resolve(XOVI_DATA_DIR, version)
  const files = readdirSync(versionDir).filter(f => f.endsWith('.qmd'))
  for (const file of files) {
    const key = `${version}/${file}`
    checksums[key] = sha512(resolve(versionDir, file))
  }
}

const manifest = {
  extensions: EXTENSION_DEFS,
  checksums,
  supportedVersions: versions,
}

const outPath = resolve(XOVI_DATA_DIR, 'manifest.json')
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`Wrote ${outPath}`)
console.log(`  ${versions.length} versions, ${Object.keys(checksums).length} files`)
