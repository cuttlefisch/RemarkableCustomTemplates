import { describe, it, expect } from 'vitest'
import { buildMethodsEntry, parseMethodsMetadata } from '../lib/methodsTemplates'

// ---------------------------------------------------------------------------
// buildMethodsEntry
// ---------------------------------------------------------------------------

describe('buildMethodsEntry', () => {
  it('builds a registry entry with correct filename format', () => {
    const entry = buildMethodsEntry({
      uuid: 'abc-123-def',
      visibleName: 'Engineering Paper',
      orientation: 'portrait',
      labels: ['Grids'],
      origin: 'official-methods',
    })
    expect(entry.filename).toBe('methods/abc-123-def')
    expect(entry.name).toBe('Engineering Paper')
    expect(entry.rmMethodsId).toBe('abc-123-def')
    expect(entry.origin).toBe('official-methods')
    expect(entry.categories).toEqual(['Grids'])
    expect(entry.landscape).toBe(false)
    expect(entry.isCustom).toBeUndefined()
  })

  it('detects landscape orientation', () => {
    const entry = buildMethodsEntry({
      uuid: 'xyz-456',
      visibleName: 'Wide Grid',
      orientation: 'landscape',
      labels: ['Grids'],
      origin: 'official-methods',
    })
    expect(entry.landscape).toBe(true)
  })

  it('tags custom-methods origin correctly', () => {
    const entry = buildMethodsEntry({
      uuid: 'my-uuid',
      visibleName: 'My Template',
      orientation: 'portrait',
      labels: ['Custom'],
      origin: 'custom-methods',
    })
    expect(entry.origin).toBe('custom-methods')
  })

  it('uses default category when labels is empty', () => {
    const entry = buildMethodsEntry({
      uuid: 'uuid-1',
      visibleName: 'Blank',
      orientation: 'portrait',
      labels: [],
      origin: 'official-methods',
    })
    expect(entry.categories).toEqual(['Uncategorized'])
  })

  it('uses a default iconCode', () => {
    const entry = buildMethodsEntry({
      uuid: 'uuid-2',
      visibleName: 'Test',
      orientation: 'portrait',
      labels: ['Lines'],
      origin: 'official-methods',
    })
    expect(entry.iconCode).toBe('\ue9d8')
  })
})

// ---------------------------------------------------------------------------
// parseMethodsMetadata
// ---------------------------------------------------------------------------

describe('parseMethodsMetadata', () => {
  it('extracts visibleName and type', () => {
    const raw = JSON.stringify({
      createdTime: '1710672000000',
      lastModified: '1710672000000',
      new: false,
      parent: '',
      pinned: false,
      source: 'com.remarkable.methods',
      type: 'TemplateType',
      visibleName: 'Engineering Paper',
    })
    const result = parseMethodsMetadata(raw)
    expect(result.visibleName).toBe('Engineering Paper')
    expect(result.type).toBe('TemplateType')
  })

  it('throws for non-TemplateType metadata', () => {
    const raw = JSON.stringify({
      type: 'DocumentType',
      visibleName: 'My Notebook',
    })
    expect(() => parseMethodsMetadata(raw)).toThrow('not a TemplateType')
  })

  it('throws for missing visibleName', () => {
    const raw = JSON.stringify({
      type: 'TemplateType',
    })
    expect(() => parseMethodsMetadata(raw)).toThrow('visibleName')
  })

  it('throws for invalid JSON', () => {
    expect(() => parseMethodsMetadata('not json')).toThrow()
  })
})
