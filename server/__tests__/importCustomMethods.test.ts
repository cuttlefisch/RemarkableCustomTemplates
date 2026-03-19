// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { importCustomMethodsEntries, type ImportCustomMethodsConfig } from '../lib/importCustomMethods.ts'

describe('importCustomMethodsEntries', () => {
  let baseDir: string
  let config: ImportCustomMethodsConfig

  beforeEach(() => {
    baseDir = resolve(tmpdir(), `import-test-${Date.now()}`)
    const methodsDir = resolve(baseDir, 'methods')
    const customDir = resolve(baseDir, 'custom')
    const debugDir = resolve(baseDir, 'debug')
    mkdirSync(methodsDir, { recursive: true })
    mkdirSync(customDir, { recursive: true })
    mkdirSync(debugDir, { recursive: true })

    config = {
      methodsRegistry: resolve(methodsDir, 'methods-registry.json'),
      customRegistry: resolve(customDir, 'custom-registry.json'),
      customDir,
      methodsDir,
      debugRegistry: resolve(debugDir, 'debug-registry.json'),
    }
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('imports custom-methods entries into custom-registry (happy path)', () => {
    const uuid = 'custom-uuid-1'
    writeFileSync(resolve(config.methodsDir, `${uuid}.template`), '{"name":"My Grid"}')
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'My Grid', filename: `methods/${uuid}`, iconCode: '\ue9d8',
        landscape: false, categories: ['Grid'], rmMethodsId: uuid, origin: 'custom-methods',
      }],
    }))

    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(1)

    const reg = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
    expect(reg.templates).toHaveLength(1)
    expect(reg.templates[0].name).toBe('My Grid')
    expect(reg.templates[0].rmMethodsId).toBe(uuid)
    expect(reg.templates[0].isCustom).toBe(true)
    expect(reg.templates[0].filename).toBe('custom/P My Grid')
    expect(existsSync(resolve(config.customDir, 'P My Grid.template'))).toBe(true)
  })

  it('skips entries already in custom-registry (by rmMethodsId)', () => {
    const uuid = 'existing-uuid'
    writeFileSync(resolve(config.methodsDir, `${uuid}.template`), '{}')
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Existing', filename: `methods/${uuid}`, iconCode: '\ue9d8',
        categories: ['Grid'], rmMethodsId: uuid, origin: 'custom-methods',
      }],
    }))
    writeFileSync(config.customRegistry, JSON.stringify({
      templates: [{ name: 'Existing', filename: 'custom/P Existing', rmMethodsId: uuid }],
    }))

    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(0)
  })

  it('skips entries already in debug-registry (by rmMethodsId)', () => {
    const uuid = 'debug-uuid-1'
    writeFileSync(resolve(config.methodsDir, `${uuid}.template`), '{}')
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Debug Template', filename: `methods/${uuid}`, iconCode: '\ue9d8',
        categories: ['Lines'], rmMethodsId: uuid, origin: 'custom-methods',
      }],
    }))
    writeFileSync(config.debugRegistry, JSON.stringify({
      templates: [{ name: 'Debug Template', filename: 'debug/MyDebug', rmMethodsId: uuid }],
    }))

    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(0)
  })

  it('skips entries without rmMethodsId', () => {
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'No ID', filename: 'methods/noid', iconCode: '\ue9d8',
        categories: ['Grid'], origin: 'custom-methods',
      }],
    }))

    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(0)
  })

  it('skips entries when template file is missing', () => {
    const uuid = 'missing-template'
    // No .template file created
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Missing', filename: `methods/${uuid}`, iconCode: '\ue9d8',
        categories: ['Grid'], rmMethodsId: uuid, origin: 'custom-methods',
      }],
    }))

    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(0)
  })

  it('returns 0 when no methods-registry exists', () => {
    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(0)
  })

  it('handles landscape templates correctly (LS prefix)', () => {
    const uuid = 'landscape-uuid'
    writeFileSync(resolve(config.methodsDir, `${uuid}.template`), '{}')
    writeFileSync(config.methodsRegistry, JSON.stringify({
      templates: [{
        name: 'Wide Grid', filename: `methods/${uuid}`, iconCode: '\ue9d8',
        landscape: true, categories: ['Grid'], rmMethodsId: uuid, origin: 'custom-methods',
      }],
    }))

    const imported = importCustomMethodsEntries(config)
    expect(imported).toBe(1)

    const reg = JSON.parse(readFileSync(config.customRegistry, 'utf8'))
    expect(reg.templates[0].filename).toBe('custom/LS Wide Grid')
    expect(reg.templates[0].landscape).toBe(true)
    expect(existsSync(resolve(config.customDir, 'LS Wide Grid.template'))).toBe(true)
  })
})
