/**
 * Pre-generate iconData for sample templates and update samples-registry.json.
 *
 * Usage: npx tsx scripts/generate-sample-icons.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseTemplate } from '../src/lib/parser.ts'
import { generateTemplateIcon } from '../src/lib/iconGenerator.ts'

const SAMPLES_DIR = resolve(import.meta.dirname, '..', 'public', 'templates', 'samples')
const REGISTRY_PATH = resolve(SAMPLES_DIR, 'samples-registry.json')

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as {
  templates: Array<Record<string, unknown>>
}

let updated = 0
for (const entry of registry.templates) {
  const filename = entry.filename as string
  // filename is like "samples/P Sample Grid" — the .template file is under SAMPLES_DIR
  const baseName = filename.replace(/^samples\//, '')
  const tplPath = resolve(SAMPLES_DIR, `${baseName}.template`)
  try {
    const tpl = parseTemplate(JSON.parse(readFileSync(tplPath, 'utf8')))
    entry.iconData = generateTemplateIcon(tpl)
    updated++
    console.log(`  OK: ${entry.name}`)
  } catch (err) {
    console.warn(`  SKIP: ${entry.name} — ${err instanceof Error ? err.message : String(err)}`)
  }
}

writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8')
console.log(`\nUpdated ${updated}/${registry.templates.length} entries in samples-registry.json`)
