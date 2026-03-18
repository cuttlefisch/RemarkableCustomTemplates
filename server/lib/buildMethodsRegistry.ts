/**
 * Build methods-registry.json from pulled rm_methods UUID files.
 * TypeScript replacement for scripts/build-methods-registry.py.
 *
 * Processes {uuid}.metadata + {uuid}.template pairs from a temp directory
 * into the methods/ output directory with a registry file.
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readManifestUuids } from './manifestUuids.ts'

export interface BuildMethodsRegistryOptions {
  tempDir: string
  outputDir: string
  manifestPath?: string
  deployedManifestPath?: string
  deviceManifestUuids?: string[]
}

export interface BuildMethodsRegistryResult {
  count: number
}

function inferOrientation(templateBody: Record<string, unknown>): string {
  const orient = templateBody.orientation
  if (orient === 'portrait' || orient === 'landscape') return orient
  return 'portrait'
}

export async function buildMethodsRegistry(opts: BuildMethodsRegistryOptions): Promise<BuildMethodsRegistryResult> {
  const { tempDir, outputDir, manifestPath, deployedManifestPath, deviceManifestUuids } = opts

  // Collect known custom UUIDs from manifests
  const customUuids = new Set<string>()
  if (manifestPath) {
    for (const uuid of readManifestUuids(manifestPath)) customUuids.add(uuid)
  }
  if (deployedManifestPath) {
    for (const uuid of readManifestUuids(deployedManifestPath)) customUuids.add(uuid)
  }
  if (deviceManifestUuids) {
    for (const uuid of deviceManifestUuids) customUuids.add(uuid)
  }

  // Find all metadata files
  const metadataFiles = readdirSync(tempDir).filter(f => f.endsWith('.metadata')).sort()
  mkdirSync(outputDir, { recursive: true })

  const entries: Array<Record<string, unknown>> = []
  let count = 0

  for (const metaFile of metadataFiles) {
    const uuid = metaFile.replace('.metadata', '')
    const templateFile = `${uuid}.template`
    const metaPath = resolve(tempDir, metaFile)
    const tplPath = resolve(tempDir, templateFile)

    // Read and validate metadata
    let metadata: Record<string, unknown>
    try {
      metadata = JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>
    } catch (e) {
      console.error(`  Skipping ${uuid}: bad metadata (${e})`)
      continue
    }

    if (metadata.type !== 'TemplateType') continue

    const visibleName = (metadata.visibleName as string) ?? uuid

    // Read template body for orientation and labels
    let orientation = 'portrait'
    let labels: string[] = []
    if (existsSync(tplPath)) {
      try {
        const tplBody = JSON.parse(readFileSync(tplPath, 'utf8')) as Record<string, unknown>
        orientation = inferOrientation(tplBody)
        const rawLabels = tplBody.labels
        if (Array.isArray(rawLabels)) {
          labels = rawLabels.filter((l: unknown) => typeof l === 'string' && l.length > 0) as string[]
        }
      } catch {
        // Use defaults
      }
    }

    // Determine origin
    const origin = customUuids.has(uuid) ? 'custom-methods' : 'official-methods'

    // Copy template file to output
    if (existsSync(tplPath)) {
      copyFileSync(tplPath, resolve(outputDir, templateFile))
    } else {
      console.error(`  Warning: ${uuid} has metadata but no .template file`)
      continue
    }

    entries.push({
      name: visibleName,
      filename: `methods/${uuid}`,
      iconCode: '\ue9d8',
      landscape: orientation === 'landscape',
      categories: labels.length > 0 ? labels : ['Uncategorized'],
      rmMethodsId: uuid,
      origin,
    })
    count++
  }

  // Write registry
  const registry = { templates: entries }
  const registryPath = resolve(outputDir, 'methods-registry.json')
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8')

  console.log(`Built methods registry: ${count} templates in ${outputDir}/`)
  return { count }
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('buildMethodsRegistry.ts')) {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: buildMethodsRegistry.ts <temp-dir> <output-dir> [--manifest <path>] [--deployed-manifest <path>]')
    process.exit(1)
  }

  const opts: BuildMethodsRegistryOptions = {
    tempDir: args[0],
    outputDir: args[1],
  }

  let i = 2
  while (i < args.length) {
    if (args[i] === '--manifest' && i + 1 < args.length) {
      opts.manifestPath = args[i + 1]
      i += 2
    } else if (args[i] === '--deployed-manifest' && i + 1 < args.length) {
      opts.deployedManifestPath = args[i + 1]
      i += 2
    } else {
      i++
    }
  }

  buildMethodsRegistry(opts)
}
