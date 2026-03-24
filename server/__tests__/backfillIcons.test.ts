// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveConfig, type ServerConfig } from '../config.ts'
import { backfillAllIcons } from '../lib/backfillIcons.ts'

const VALID_TEMPLATE = {
  name: 'Test Grid',
  author: 'Test',
  templateVersion: '1.0.0',
  formatVersion: 1,
  categories: ['Grid'],
  orientation: 'portrait',
  constants: [],
  items: [
    {
      type: 'path',
      data: ['M', 0, 0, 'L', 100, 100],
      strokeWidth: 1,
    },
  ],
}

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `backfill-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/samples'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

describe('backfillAllIcons', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  it('backfills missing iconData in methods registry', () => {
    const uuid = 'abc-123'
    // Write template file
    writeFileSync(resolve(config.methodsDir, `${uuid}.template`), JSON.stringify(VALID_TEMPLATE))
    // Write registry without iconData
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Test Grid',
        filename: `methods/${uuid}`,
        iconCode: '\ue9d8',
        landscape: false,
        categories: ['Grid'],
        rmMethodsId: uuid,
      }],
    }))

    backfillAllIcons(config)

    const registry = JSON.parse(readFileSync(config.methodsRegistry, 'utf8'))
    expect(registry.templates[0].iconData).toBeDefined()
    expect(typeof registry.templates[0].iconData).toBe('string')
    // Should be valid base64-encoded SVG
    const svg = Buffer.from(registry.templates[0].iconData, 'base64').toString('utf8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('skips entries that already have iconData', () => {
    const uuid = 'existing-icon'
    writeFileSync(resolve(config.methodsDir, `${uuid}.template`), JSON.stringify(VALID_TEMPLATE))
    const existingIcon = 'already-has-icon-data'
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Already Has Icon',
        filename: `methods/${uuid}`,
        iconCode: '\ue9d8',
        landscape: false,
        categories: ['Grid'],
        rmMethodsId: uuid,
        iconData: existingIcon,
      }],
    }))

    backfillAllIcons(config)

    const registry = JSON.parse(readFileSync(config.methodsRegistry, 'utf8'))
    expect(registry.templates[0].iconData).toBe(existingIcon)
  })

  it('skips entries with missing template files', () => {
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Missing Template',
        filename: 'methods/no-such-file',
        iconCode: '\ue9d8',
        landscape: false,
        categories: ['Grid'],
        rmMethodsId: 'no-such-file',
      }],
    }))

    backfillAllIcons(config)

    const registry = JSON.parse(readFileSync(config.methodsRegistry, 'utf8'))
    expect(registry.templates[0].iconData).toBeUndefined()
  })

  it('backfills across multiple registries', () => {
    const uuid = 'custom-tpl'
    // Custom registry
    writeFileSync(resolve(config.customDir, `${uuid}.template`), JSON.stringify(VALID_TEMPLATE))
    writeFileSync(config.customRegistry, JSON.stringify({
      templates: [{
        name: 'Custom Template',
        filename: `custom/${uuid}`,
        iconCode: '\ue9d8',
        landscape: false,
        categories: ['Grid'],
      }],
    }))

    // Methods registry
    const uuid2 = 'methods-tpl'
    writeFileSync(resolve(config.methodsDir, `${uuid2}.template`), JSON.stringify(VALID_TEMPLATE))
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Methods Template',
        filename: `methods/${uuid2}`,
        iconCode: '\ue9d8',
        landscape: false,
        categories: ['Grid'],
        rmMethodsId: uuid2,
      }],
    }))

    backfillAllIcons(config)

    const custom = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
    expect(custom.templates[0].iconData).toBeDefined()

    const methods = JSON.parse(readFileSync(config.methodsRegistry, 'utf8'))
    expect(methods.templates[0].iconData).toBeDefined()
  })
})
