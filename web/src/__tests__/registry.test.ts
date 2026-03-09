import { describe, it, expect } from 'vitest'
import {
  parseRegistry,
  addEntry,
  removeEntry,
  updateEntry,
  filterByCategory,
} from '../lib/registry'
import type { TemplateRegistry, TemplateRegistryEntry } from '../types/registry'

const SAMPLE_ENTRY: TemplateRegistryEntry = {
  name: 'Lined medium',
  filename: 'P Lines medium',
  iconCode: '\ue9a7',
  landscape: false,
  categories: ['Lines'],
}

const SAMPLE_REGISTRY: TemplateRegistry = {
  templates: [
    SAMPLE_ENTRY,
    {
      name: 'Grid small',
      filename: 'P Grid small',
      iconCode: '\ue99e',
      landscape: false,
      categories: ['Grids'],
    },
    {
      name: 'Day planner',
      filename: 'LS Dayplanner',
      iconCode: '\ue9ac',
      landscape: true,
      categories: ['Planners'],
    },
  ],
}

describe('parseRegistry', () => {
  it('parses a valid registry object', () => {
    const raw = { templates: [SAMPLE_ENTRY] }
    const result = parseRegistry(raw)
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0]?.name).toBe('Lined medium')
  })

  it('throws on non-object input', () => {
    expect(() => parseRegistry(null)).toThrow()
    expect(() => parseRegistry('string')).toThrow()
  })

  it('throws when templates array is missing', () => {
    expect(() => parseRegistry({})).toThrow(/templates/)
  })

  it('defaults landscape to false when absent', () => {
    const raw = {
      templates: [
        { name: 'X', filename: 'X', iconCode: '\ue9fe', categories: ['Lines'] },
      ],
    }
    const result = parseRegistry(raw)
    expect(result.templates[0]?.landscape).toBe(false)
  })
})

describe('addEntry', () => {
  it('appends an entry to the registry', () => {
    const newEntry: TemplateRegistryEntry = {
      name: 'Custom',
      filename: 'My Custom',
      iconCode: '\ue9fe',
      landscape: false,
      categories: ['Creative'],
    }
    const result = addEntry(SAMPLE_REGISTRY, newEntry)
    expect(result.templates).toHaveLength(4)
    expect(result.templates[3]?.filename).toBe('My Custom')
  })

  it('does not mutate the original registry', () => {
    const original = { ...SAMPLE_REGISTRY }
    addEntry(SAMPLE_REGISTRY, SAMPLE_ENTRY)
    expect(SAMPLE_REGISTRY.templates).toHaveLength(original.templates.length)
  })
})

describe('removeEntry', () => {
  it('removes an entry by filename', () => {
    const result = removeEntry(SAMPLE_REGISTRY, 'P Grid small')
    expect(result.templates).toHaveLength(2)
    expect(result.templates.find(t => t.filename === 'P Grid small')).toBeUndefined()
  })

  it('returns registry unchanged if filename not found', () => {
    const result = removeEntry(SAMPLE_REGISTRY, 'Nonexistent')
    expect(result.templates).toHaveLength(3)
  })

  it('does not mutate the original registry', () => {
    removeEntry(SAMPLE_REGISTRY, 'P Lines medium')
    expect(SAMPLE_REGISTRY.templates).toHaveLength(3)
  })
})

describe('updateEntry', () => {
  it('patches matching entry by filename', () => {
    const result = updateEntry(SAMPLE_REGISTRY, 'P Lines medium', { name: 'Updated Name' })
    const entry = result.templates.find(t => t.filename === 'P Lines medium')
    expect(entry?.name).toBe('Updated Name')
    expect(entry?.categories).toEqual(['Lines'])
  })

  it('leaves other entries unchanged', () => {
    const result = updateEntry(SAMPLE_REGISTRY, 'P Lines medium', { name: 'X' })
    const other = result.templates.find(t => t.filename === 'P Grid small')
    expect(other?.name).toBe('Grid small')
  })

  it('does not mutate original entry', () => {
    updateEntry(SAMPLE_REGISTRY, 'P Lines medium', { name: 'Changed' })
    expect(SAMPLE_ENTRY.name).toBe('Lined medium')
  })
})

describe('filterByCategory', () => {
  it('returns only templates in the given category', () => {
    const result = filterByCategory(SAMPLE_REGISTRY, 'Grids')
    expect(result).toHaveLength(1)
    expect(result[0]?.filename).toBe('P Grid small')
  })

  it('returns empty array when no matches', () => {
    expect(filterByCategory(SAMPLE_REGISTRY, 'Dark')).toEqual([])
  })

  it('returns landscape templates when category matches', () => {
    const result = filterByCategory(SAMPLE_REGISTRY, 'Planners')
    expect(result[0]?.landscape).toBe(true)
  })
})
