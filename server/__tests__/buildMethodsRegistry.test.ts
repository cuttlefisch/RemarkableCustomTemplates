// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { buildMethodsRegistry } from '../lib/buildMethodsRegistry.ts'

describe('buildMethodsRegistry', () => {
  let tmpDir: string
  let outputDir: string

  beforeEach(() => {
    const base = resolve(tmpdir(), `methods-test-${Date.now()}`)
    tmpDir = resolve(base, 'temp')
    outputDir = resolve(base, 'output')
    mkdirSync(tmpDir, { recursive: true })
    mkdirSync(outputDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(resolve(tmpDir, '..'), { recursive: true, force: true })
  })

  it('builds registry from metadata + template pairs', async () => {
    const uuid = 'test-uuid-1234'
    writeFileSync(resolve(tmpDir, `${uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: 'Test Template',
    }))
    writeFileSync(resolve(tmpDir, `${uuid}.template`), JSON.stringify({
      name: 'Test Template',
      orientation: 'portrait',
      labels: ['Custom', 'Grid'],
    }))

    const result = await buildMethodsRegistry({ tempDir: tmpDir, outputDir })
    expect(result.count).toBe(1)

    const registry = JSON.parse(readFileSync(resolve(outputDir, 'methods-registry.json'), 'utf8'))
    expect(registry.templates).toHaveLength(1)
    expect(registry.templates[0].name).toBe('Test Template')
    expect(registry.templates[0].filename).toBe(`methods/${uuid}`)
    expect(registry.templates[0].landscape).toBe(false)
    expect(registry.templates[0].categories).toEqual(['Custom', 'Grid'])
    expect(registry.templates[0].rmMethodsId).toBe(uuid)
    expect(registry.templates[0].origin).toBe('custom-methods')

    // Template file should be copied to output
    expect(existsSync(resolve(outputDir, `${uuid}.template`))).toBe(true)
  })

  it('skips non-TemplateType metadata', async () => {
    writeFileSync(resolve(tmpDir, 'doc.metadata'), JSON.stringify({
      type: 'DocumentType',
      visibleName: 'My Doc',
    }))

    const result = await buildMethodsRegistry({ tempDir: tmpDir, outputDir })
    expect(result.count).toBe(0)
  })

  it('tags UUIDs found in manifest as custom-methods', async () => {
    const uuid = 'custom-uuid-5678'
    writeFileSync(resolve(tmpDir, `${uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: 'Custom Tpl',
    }))
    writeFileSync(resolve(tmpDir, `${uuid}.template`), JSON.stringify({
      name: 'Custom Tpl',
      orientation: 'landscape',
    }))

    const manifestPath = resolve(tmpDir, '.manifest')
    writeFileSync(manifestPath, JSON.stringify({
      exportedAt: '123',
      templates: { [uuid]: { name: 'Custom Tpl' } },
    }))

    const result = await buildMethodsRegistry({ tempDir: tmpDir, outputDir, manifestPath })
    expect(result.count).toBe(1)

    const registry = JSON.parse(readFileSync(resolve(outputDir, 'methods-registry.json'), 'utf8'))
    expect(registry.templates[0].origin).toBe('custom-methods')
    expect(registry.templates[0].landscape).toBe(true)
  })

  it('classifies template with "Custom" label as custom-methods', async () => {
    const uuid = 'custom-label-uuid'
    writeFileSync(resolve(tmpDir, `${uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: 'Custom Label Tpl',
    }))
    writeFileSync(resolve(tmpDir, `${uuid}.template`), JSON.stringify({
      name: 'Custom Label Tpl',
      orientation: 'portrait',
      labels: ['Custom'],
    }))

    const result = await buildMethodsRegistry({ tempDir: tmpDir, outputDir })
    expect(result.count).toBe(1)

    const registry = JSON.parse(readFileSync(resolve(outputDir, 'methods-registry.json'), 'utf8'))
    expect(registry.templates[0].origin).toBe('custom-methods')
  })

  it('classifies template with UUID in debugUuids as official-methods', async () => {
    const uuid = 'debug-uuid-9999'
    writeFileSync(resolve(tmpDir, `${uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: 'Debug Template',
    }))
    writeFileSync(resolve(tmpDir, `${uuid}.template`), JSON.stringify({
      name: 'Debug Template',
      orientation: 'portrait',
      labels: ['Custom'],
    }))

    // Even with "Custom" label AND manifest match, debugUuids should override
    const manifestPath = resolve(tmpDir, '.manifest')
    writeFileSync(manifestPath, JSON.stringify({
      exportedAt: '123',
      templates: { [uuid]: { name: 'Debug Template' } },
    }))

    const result = await buildMethodsRegistry({
      tempDir: tmpDir,
      outputDir,
      manifestPath,
      debugUuids: [uuid],
    })
    expect(result.count).toBe(1)

    const registry = JSON.parse(readFileSync(resolve(outputDir, 'methods-registry.json'), 'utf8'))
    expect(registry.templates[0].origin).toBe('official-methods')
  })

  it('classifies template with no custom signals as official-methods', async () => {
    const uuid = 'official-uuid-1111'
    writeFileSync(resolve(tmpDir, `${uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: 'Official Template',
    }))
    writeFileSync(resolve(tmpDir, `${uuid}.template`), JSON.stringify({
      name: 'Official Template',
      orientation: 'portrait',
      labels: ['Lines'],
    }))

    const result = await buildMethodsRegistry({ tempDir: tmpDir, outputDir })
    expect(result.count).toBe(1)

    const registry = JSON.parse(readFileSync(resolve(outputDir, 'methods-registry.json'), 'utf8'))
    expect(registry.templates[0].origin).toBe('official-methods')
  })

  it('defaults labels to Uncategorized when absent', async () => {
    const uuid = 'no-labels-uuid'
    writeFileSync(resolve(tmpDir, `${uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: 'No Labels',
    }))
    writeFileSync(resolve(tmpDir, `${uuid}.template`), JSON.stringify({
      name: 'No Labels',
    }))

    await buildMethodsRegistry({ tempDir: tmpDir, outputDir })
    const registry = JSON.parse(readFileSync(resolve(outputDir, 'methods-registry.json'), 'utf8'))
    expect(registry.templates[0].categories).toEqual(['Uncategorized'])
  })
})
