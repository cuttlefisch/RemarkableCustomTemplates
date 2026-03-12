import { describe, it, expect } from 'vitest'
import {
  slugify,
  validateCustomName,
  buildCustomEntry,
  buildDefaultTemplate,
  mergeRegistries,
  buildBackgroundItem,
  toggleDark,
  DARK_BG_COLOR,
} from '../lib/customTemplates'
import { parseTemplate } from '../lib/parser'
import type { TemplateRegistry } from '../types/registry'

// ─── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My Grid')).toBe('my-grid')
  })

  it('handles multiple spaces', () => {
    expect(slugify('My  Big  Grid')).toBe('my-big-grid')
  })

  it('strips non-alphanumeric chars (except hyphens)', () => {
    expect(slugify('Grid (v2)!')).toBe('grid-v2')
  })

  it('collapses multiple hyphens into one', () => {
    expect(slugify('A -- B')).toBe('a-b')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --My Grid--  ')).toBe('my-grid')
  })

  it('returns empty string for all-special input', () => {
    expect(slugify('!!!###')).toBe('')
  })

  it('handles numbers', () => {
    expect(slugify('Grid 2024')).toBe('grid-2024')
  })

  it('handles already-slugified input unchanged', () => {
    expect(slugify('my-grid-2')).toBe('my-grid-2')
  })
})

// ─── validateCustomName ───────────────────────────────────────────────────────

describe('validateCustomName', () => {
  it('returns null for a valid name', () => {
    expect(validateCustomName('My Grid', [])).toBeNull()
  })

  it('returns error for empty name', () => {
    expect(validateCustomName('', [])).not.toBeNull()
  })

  it('returns error for whitespace-only name', () => {
    expect(validateCustomName('   ', [])).not.toBeNull()
  })

  it('returns error for name longer than 64 chars', () => {
    expect(validateCustomName('a'.repeat(65), [])).not.toBeNull()
  })

  it('accepts name exactly 64 chars', () => {
    expect(validateCustomName('a'.repeat(64), [])).toBeNull()
  })

  it('returns error for duplicate name (case-insensitive)', () => {
    expect(validateCustomName('My Grid', ['My Grid'])).not.toBeNull()
    expect(validateCustomName('my grid', ['My Grid'])).not.toBeNull()
  })

  it('allows name not in existing list', () => {
    expect(validateCustomName('New Grid', ['My Grid', 'Other'])).toBeNull()
  })

  it('returns error when slug would be empty', () => {
    expect(validateCustomName('!!!', [])).not.toBeNull()
  })
})

// ─── buildCustomEntry ─────────────────────────────────────────────────────────

describe('buildCustomEntry', () => {
  it('sets isCustom to true', () => {
    expect(buildCustomEntry('My Grid', false).isCustom).toBe(true)
  })

  it('uses P prefix for portrait filename', () => {
    const entry = buildCustomEntry('My Grid', false)
    expect(entry.filename).toBe('custom/P My Grid')
  })

  it('uses LS prefix for landscape filename', () => {
    expect(buildCustomEntry('My Grid', true).filename).toBe('custom/LS My Grid')
  })

  it('sets landscape correctly', () => {
    expect(buildCustomEntry('Grid', true).landscape).toBe(true)
    expect(buildCustomEntry('Grid', false).landscape).toBe(false)
  })

  it('sets name from input', () => {
    expect(buildCustomEntry('My Grid', false).name).toBe('My Grid')
  })

  it('has a non-empty iconCode', () => {
    expect(buildCustomEntry('Grid', false).iconCode.length).toBeGreaterThan(0)
  })

  it('has a non-empty categories array', () => {
    expect(buildCustomEntry('Grid', false).categories.length).toBeGreaterThan(0)
  })

  it('defaults categories to ["Custom"]', () => {
    expect(buildCustomEntry('Grid', false).categories).toEqual(['Custom'])
  })

  it('uses provided categories', () => {
    expect(buildCustomEntry('Grid', false, ['Custom', 'Dark']).categories).toEqual(['Custom', 'Dark'])
  })
})

// ─── buildBackgroundItem ──────────────────────────────────────────────────────

describe('buildBackgroundItem', () => {
  it('returns a group item with id "bg"', () => {
    const item = buildBackgroundItem()
    expect(item.id).toBe('bg')
    expect(item.type).toBe('group')
  })

  it('has a full-page bounding box using template dimensions', () => {
    const item = buildBackgroundItem()
    expect(item.boundingBox.width).toBe('templateWidth')
    expect(item.boundingBox.height).toBe('templateHeight')
  })

  it('has one child path with dark fill', () => {
    const item = buildBackgroundItem()
    expect(item.children).toHaveLength(1)
    const child = item.children[0]
    expect(child.type).toBe('path')
    if (child.type === 'path') {
      expect(child.fillColor).toBe(DARK_BG_COLOR)
    }
  })
})

// ─── toggleDark ───────────────────────────────────────────────────────────────

const TOGGLEABLE_JSON = JSON.stringify({
  name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Lines'], orientation: 'portrait', constants: [], items: [],
})

describe('toggleDark', () => {
  it('adds "Dark" to categories when dark=true', () => {
    const result = JSON.parse(toggleDark(TOGGLEABLE_JSON, true))
    expect(result.categories).toContain('Dark')
  })

  it('removes "Dark" from categories when dark=false', () => {
    const darkJson = JSON.stringify({ ...JSON.parse(TOGGLEABLE_JSON), categories: ['Dark', 'Lines'] })
    const result = JSON.parse(toggleDark(darkJson, false))
    expect(result.categories).not.toContain('Dark')
  })

  it('preserves other categories when toggling dark on', () => {
    const result = JSON.parse(toggleDark(TOGGLEABLE_JSON, true))
    expect(result.categories).toContain('Lines')
  })

  it('prepends bg item when dark=true', () => {
    const result = JSON.parse(toggleDark(TOGGLEABLE_JSON, true))
    expect(result.items[0]?.id).toBe('bg')
  })

  it('removes bg item when dark=false', () => {
    const darkJson = toggleDark(TOGGLEABLE_JSON, true)
    const result = JSON.parse(toggleDark(darkJson, false))
    expect(result.items.find((i: { id?: string }) => i.id === 'bg')).toBeUndefined()
  })

  it('does not duplicate bg item when called twice with dark=true', () => {
    const once = toggleDark(TOGGLEABLE_JSON, true)
    const twice = JSON.parse(toggleDark(once, true))
    const bgCount = twice.items.filter((i: { id?: string }) => i.id === 'bg').length
    expect(bgCount).toBe(1)
  })

  it('returns valid JSON', () => {
    expect(() => JSON.parse(toggleDark(TOGGLEABLE_JSON, true))).not.toThrow()
    expect(() => JSON.parse(toggleDark(TOGGLEABLE_JSON, false))).not.toThrow()
  })
})

// ─── buildDefaultTemplate ─────────────────────────────────────────────────────

describe('buildDefaultTemplate', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(buildDefaultTemplate('My Grid', false))).not.toThrow()
  })
  it('sets name field', () => {
    const t = JSON.parse(buildDefaultTemplate('My Grid', false))
    expect(t.name).toBe('My Grid')
  })
  it('sets orientation to portrait for landscape=false', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false))
    expect(t.orientation).toBe('portrait')
  })
  it('sets orientation to landscape for landscape=true', () => {
    const t = JSON.parse(buildDefaultTemplate('X', true))
    expect(t.orientation).toBe('landscape')
  })
  it('has non-empty constants array', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false))
    expect(t.constants.length).toBeGreaterThan(0)
  })
  it('has empty items array', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false))
    expect(t.items).toEqual([])
  })
  it('parses as a valid RemarkableTemplate', () => {
    expect(() => parseTemplate(JSON.parse(buildDefaultTemplate('X', false)))).not.toThrow()
  })
})

// ─── mergeRegistries ──────────────────────────────────────────────────────────

describe('mergeRegistries', () => {
  const makeRegistry = (names: string[], isCustom = false): TemplateRegistry => ({
    templates: names.map(n => ({
      name: n,
      filename: isCustom ? `custom/${n.toLowerCase()}` : n.toLowerCase(),
      iconCode: 'e001',
      categories: ['Lines'],
      isCustom: isCustom || undefined,
    })),
  })

  it('custom entries appear before main entries', () => {
    const main = makeRegistry(['A', 'B'])
    const custom = makeRegistry(['C'], true)
    const merged = mergeRegistries(main, custom)
    expect(merged.templates[0].name).toBe('C')
    expect(merged.templates[1].name).toBe('A')
    expect(merged.templates[2].name).toBe('B')
  })

  it('handles empty custom registry', () => {
    const main = makeRegistry(['A', 'B'])
    const merged = mergeRegistries(main, { templates: [] })
    expect(merged.templates).toHaveLength(2)
  })

  it('handles empty main registry', () => {
    const custom = makeRegistry(['C'], true)
    const merged = mergeRegistries({ templates: [] }, custom)
    expect(merged.templates).toHaveLength(1)
    expect(merged.templates[0].name).toBe('C')
  })

  it('handles both empty', () => {
    const merged = mergeRegistries({ templates: [] }, { templates: [] })
    expect(merged.templates).toHaveLength(0)
  })

  it('total length equals sum of both', () => {
    const main = makeRegistry(['A', 'B', 'C'])
    const custom = makeRegistry(['D', 'E'], true)
    const merged = mergeRegistries(main, custom)
    expect(merged.templates).toHaveLength(5)
  })

  it('does not mutate inputs', () => {
    const main = makeRegistry(['A'])
    const custom = makeRegistry(['B'], true)
    mergeRegistries(main, custom)
    expect(main.templates).toHaveLength(1)
    expect(custom.templates).toHaveLength(1)
  })
})
