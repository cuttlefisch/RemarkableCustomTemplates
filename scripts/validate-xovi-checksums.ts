/**
 * Validate SHA-512 checksums for bundled xovi extension QMD files.
 * Exits with code 1 if any checksum mismatches.
 *
 * Usage: npx tsx scripts/validate-xovi-checksums.ts
 */

import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XOVI_DATA_DIR = resolve(__dirname, '../server/data/xovi-extensions')
const manifestPath = resolve(XOVI_DATA_DIR, 'manifest.json')

if (!existsSync(manifestPath)) {
  console.error('manifest.json not found — run generate-xovi-manifest.ts first')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
  checksums: Record<string, string>
}

let ok = true
let checked = 0

for (const [relPath, expectedHash] of Object.entries(manifest.checksums)) {
  const filePath = resolve(XOVI_DATA_DIR, relPath)
  if (!existsSync(filePath)) {
    console.error(`MISSING  ${relPath}`)
    ok = false
    continue
  }
  const content = readFileSync(filePath)
  const actual = createHash('sha512').update(content).digest('hex')
  if (actual !== expectedHash) {
    console.error(`MISMATCH ${relPath}`)
    console.error(`  expected: ${expectedHash}`)
    console.error(`  actual:   ${actual}`)
    ok = false
  } else {
    checked++
  }
}

if (ok) {
  console.log(`All ${checked} QMD file checksums verified.`)
} else {
  console.error('\nChecksum validation failed.')
  process.exit(1)
}
