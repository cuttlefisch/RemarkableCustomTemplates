import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { generateBuiltinNotebook } from '../lib/builtinNotebooks.ts'

describe('generateBuiltinNotebook', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'builtin-nb-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates a notebook from a minimal registry', () => {
    const registry = {
      templates: [
        { name: 'Grid', filename: 'samples/P Grid', iconCode: '', categories: ['Grids'], iconData: 'abc123' },
        { name: 'Lines', filename: 'samples/P Lines', iconCode: '', categories: ['Lines'] },
      ],
    }
    const registryPath = resolve(tmpDir, 'samples-registry.json')
    writeFileSync(registryPath, JSON.stringify(registry))

    const notebook = generateBuiltinNotebook(registryPath, '__sample-notebook__', 'Sample Notebook', 'sample')

    expect(notebook).not.toBeNull()
    expect(notebook!.id).toBe('__sample-notebook__')
    expect(notebook!.name).toBe('Sample Notebook')
    expect(notebook!.source).toBe('sample')
    expect(notebook!.deviceId).toBe('rm')
    expect(notebook!.orientation).toBe('portrait')
    expect(notebook!.lastModified).toBe(0)
    expect(notebook!.pageGroups).toHaveLength(2)
    expect(notebook!.pageGroups[0].templateName).toBe('Grid')
    expect(notebook!.pageGroups[0].templateRef).toBe('samples/P Grid')
    expect(notebook!.pageGroups[0].count).toBe(1)
    expect(notebook!.pageGroups[0].iconData).toBe('abc123')
    expect(notebook!.pageGroups[1].templateName).toBe('Lines')
    expect(notebook!.pageGroups[1].iconData).toBeUndefined()
  })

  it('returns null for missing registry file', () => {
    const result = generateBuiltinNotebook('/nonexistent/path.json', '__test__', 'Test', 'sample')
    expect(result).toBeNull()
  })

  it('returns null for empty registry', () => {
    const registryPath = resolve(tmpDir, 'empty.json')
    writeFileSync(registryPath, JSON.stringify({ templates: [] }))

    const result = generateBuiltinNotebook(registryPath, '__test__', 'Test', 'debug')
    expect(result).toBeNull()
  })

  it('uses rmMethodsId:orientation format for methods templates', () => {
    const registry = {
      templates: [
        { name: 'Methods Grid', filename: 'debug/P Grid', iconCode: '', categories: ['Debug'], rmMethodsId: 'abc-123' },
      ],
    }
    const registryPath = resolve(tmpDir, 'debug-registry.json')
    writeFileSync(registryPath, JSON.stringify(registry))

    const notebook = generateBuiltinNotebook(registryPath, '__debug-notebook__', 'Debug Notebook', 'debug')

    expect(notebook!.pageGroups[0].templateRef).toBe('abc-123:p')
  })

  it('uses landscape orientation for landscape templates', () => {
    const registry = {
      templates: [
        { name: 'LS Grid', filename: 'samples/LS Grid', iconCode: '', categories: ['Grids'], landscape: true, rmMethodsId: 'def-456' },
      ],
    }
    const registryPath = resolve(tmpDir, 'samples-registry.json')
    writeFileSync(registryPath, JSON.stringify(registry))

    const notebook = generateBuiltinNotebook(registryPath, '__sample-notebook__', 'Sample', 'sample')

    expect(notebook!.pageGroups[0].templateRef).toBe('def-456:l')
  })
})
