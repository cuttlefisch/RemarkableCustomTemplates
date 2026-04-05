/**
 * Validate SHA-512 checksums for bundled xovi extension QMD files.
 * Exits with code 1 if any checksum mismatches.
 *
 * Normalizes line endings (CRLF → LF) before hashing so that checksums
 * are stable across platforms even without .gitattributes protection.
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

/** Normalize CRLF → LF so checksums are stable across platforms. */
function normalizeLF(buf: Buffer): Buffer {
  // Fast path: no CR bytes at all
  if (!buf.includes(0x0d)) return buf
  // Strip \r from \r\n sequences
  const out: number[] = []
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0d && i + 1 < buf.length && buf[i + 1] === 0x0a) continue
    out.push(buf[i]!)
  }
  return Buffer.from(out)
}

/** Compute SHA-512 of a buffer after LF normalization. */
export function sha512Normalized(buf: Buffer): string {
  return createHash('sha512').update(normalizeLF(buf)).digest('hex')
}

if (!existsSync(manifestPath)) {
  console.error('manifest.json not found — run generate-xovi-manifest.ts first')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
  checksums: Record<string, string>
}

let ok = true
let checked = 0
let crlfDetected = false

for (const [relPath, expectedHash] of Object.entries(manifest.checksums)) {
  const filePath = resolve(XOVI_DATA_DIR, relPath)
  if (!existsSync(filePath)) {
    console.error(`MISSING  ${relPath}`)
    ok = false
    continue
  }
  const raw = readFileSync(filePath)
  if (raw.includes(0x0d)) crlfDetected = true
  const actual = sha512Normalized(raw)
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
  if (crlfDetected) {
    console.warn(
      'WARNING: Some QMD files contain CRLF line endings (normalized before hashing).\n' +
      'Run "git add --renormalize ." to fix, or ensure .gitattributes is present.',
    )
  }
} else {
  console.error('\nChecksum validation failed.')
  if (crlfDetected) {
    console.error(
      'HINT: CRLF line endings detected — this is a common cause of checksum mismatches.\n' +
      'Ensure .gitattributes marks *.qmd with eol=lf, then re-checkout:\n' +
      '  git rm --cached server/data/xovi-extensions/**/*.qmd\n' +
      '  git checkout -- server/data/xovi-extensions/',
    )
  }
  process.exit(1)
}
