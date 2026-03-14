import { describe, it, expect } from 'vitest'
import {
  slugify,
  validateCustomName,
  buildCustomEntry,
  buildDefaultTemplate,
  mergeRegistries,
  buildBackgroundItem,
  invertColors,
  resolveStringConstants,
  injectColorConstants,
  syncBgItemColor,
  DARK_BG_COLOR,
  LIGHT_BG_COLOR,
  FOREGROUND_CONST,
  BACKGROUND_CONST,
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

  it('has infinite repeat for rows and columns', () => {
    const item = buildBackgroundItem()
    expect(item.repeat?.rows).toBe('infinite')
    expect(item.repeat?.columns).toBe('infinite')
  })

  it('path data uses parentWidth/parentHeight', () => {
    const item = buildBackgroundItem()
    const child = item.children[0]
    if (child.type === 'path') {
      expect(child.data).toContain('parentWidth')
      expect(child.data).toContain('parentHeight')
      expect(child.data).not.toContain('templateWidth')
      expect(child.data).not.toContain('templateHeight')
    }
  })

  it('has one child path with fill/stroke referencing background constant by name', () => {
    const item = buildBackgroundItem()
    expect(item.children).toHaveLength(1)
    const child = item.children[0]
    expect(child.type).toBe('path')
    if (child.type === 'path') {
      expect(child.fillColor).toBe(BACKGROUND_CONST)
      expect(child.strokeColor).toBe(BACKGROUND_CONST)
    }
  })
})

// ─── invertColors ─────────────────────────────────────────────────────────────

const BASE_WITH_COLORS = JSON.stringify({
  name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Lines'], orientation: 'portrait',
  constants: [{ [FOREGROUND_CONST]: '#000000' }, { [BACKGROUND_CONST]: '#ffffff' }],
  items: [],
})

const BASE_NO_COLORS = JSON.stringify({
  name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Lines'], orientation: 'portrait',
  constants: [], items: [],
})

describe('invertColors', () => {
  it('swaps foreground and background constant values', () => {
    const result = JSON.parse(invertColors(BASE_WITH_COLORS)) as {
      constants: Record<string, string>[]
    }
    const fg = result.constants.find(e => FOREGROUND_CONST in e)?.[FOREGROUND_CONST]
    const bg = result.constants.find(e => BACKGROUND_CONST in e)?.[BACKGROUND_CONST]
    expect(fg).toBe('#ffffff')
    expect(bg).toBe('#000000')
  })

  it('is idempotent when called twice (toggles back)', () => {
    const once = invertColors(BASE_WITH_COLORS)
    const twice = JSON.parse(invertColors(once)) as { constants: Record<string, string>[] }
    const fg = twice.constants.find(e => FOREGROUND_CONST in e)?.[FOREGROUND_CONST]
    const bg = twice.constants.find(e => BACKGROUND_CONST in e)?.[BACKGROUND_CONST]
    expect(fg).toBe('#000000')
    expect(bg).toBe('#ffffff')
  })

  it('inserts light-mode defaults when constants absent, then swaps', () => {
    const result = JSON.parse(invertColors(BASE_NO_COLORS)) as {
      constants: Record<string, string>[]
    }
    const fg = result.constants.find(e => FOREGROUND_CONST in e)?.[FOREGROUND_CONST]
    const bg = result.constants.find(e => BACKGROUND_CONST in e)?.[BACKGROUND_CONST]
    // defaults: fg=DARK_BG_COLOR (#000000), bg=LIGHT_BG_COLOR (#ffffff) → swapped
    expect(fg).toBe(LIGHT_BG_COLOR)
    expect(bg).toBe(DARK_BG_COLOR)
  })

  it('does not touch items or categories', () => {
    const withItems = JSON.stringify({
      name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Lines', 'Custom'], orientation: 'portrait',
      constants: [{ [FOREGROUND_CONST]: '#000000' }, { [BACKGROUND_CONST]: '#ffffff' }],
      items: [{ id: 'x', type: 'group' }],
    })
    const result = JSON.parse(invertColors(withItems)) as {
      categories: string[]
      items: unknown[]
    }
    expect(result.categories).toEqual(['Lines', 'Custom'])
    expect(result.items).toHaveLength(1)
  })

  it('does not touch bg item', () => {
    const withBg = JSON.stringify({
      name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Lines'], orientation: 'portrait',
      constants: [{ [FOREGROUND_CONST]: '#000000' }, { [BACKGROUND_CONST]: '#ffffff' }],
      items: [buildBackgroundItem()],
    })
    const result = JSON.parse(invertColors(withBg)) as {
      items: { id?: string; children?: { fillColor?: string }[] }[]
    }
    const bgItem = result.items.find(i => i.id === 'bg')
    expect(bgItem?.children?.[0]?.fillColor).toBe(BACKGROUND_CONST)
  })
})

// ─── resolveStringConstants ───────────────────────────────────────────────────

const makeTemplateJson = (
  constants: Record<string, unknown>[],
  items: unknown[],
) => JSON.stringify({
  name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Custom'], orientation: 'portrait',
  constants,
  items,
})

describe('resolveStringConstants', () => {
  it('replaces fillColor constant name with resolved hex', () => {
    const json = makeTemplateJson(
      [{ foreground: '#000000' }, { background: '#ffffff' }],
      [{ type: 'path', fillColor: 'background', strokeColor: '#000000', data: [] }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as {
      items: { fillColor?: string }[]
    }
    expect(result.items[0]?.fillColor).toBe('#ffffff')
  })

  it('replaces strokeColor constant name with resolved hex', () => {
    const json = makeTemplateJson(
      [{ foreground: '#000000' }],
      [{ type: 'path', fillColor: '#ffffff', strokeColor: 'foreground', data: [] }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as {
      items: { strokeColor?: string }[]
    }
    expect(result.items[0]?.strokeColor).toBe('#000000')
  })

  it('resolves recursively in nested group children', () => {
    const json = makeTemplateJson(
      [{ background: '#aabbcc' }],
      [{
        type: 'group', id: 'bg',
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
        repeat: { rows: 1, columns: 1 },
        children: [{ type: 'path', fillColor: 'background', strokeColor: 'background', data: [] }],
      }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as {
      items: { children?: { fillColor?: string; strokeColor?: string }[] }[]
    }
    expect(result.items[0]?.children?.[0]?.fillColor).toBe('#aabbcc')
    expect(result.items[0]?.children?.[0]?.strokeColor).toBe('#aabbcc')
  })

  it('leaves hex values unchanged (#xxxxxx passthrough)', () => {
    const json = makeTemplateJson(
      [{ foreground: '#000000' }],
      [{ type: 'path', fillColor: '#112233', strokeColor: '#445566', data: [] }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as {
      items: { fillColor?: string; strokeColor?: string }[]
    }
    expect(result.items[0]?.fillColor).toBe('#112233')
    expect(result.items[0]?.strokeColor).toBe('#445566')
  })

  it('leaves unknown constant names unchanged', () => {
    const json = makeTemplateJson(
      [{ foreground: '#000000' }],
      [{ type: 'path', fillColor: 'unknownConst', strokeColor: '#000000', data: [] }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as {
      items: { fillColor?: string }[]
    }
    expect(result.items[0]?.fillColor).toBe('unknownConst')
  })

  it('no-op effect when no color constants in template', () => {
    const json = makeTemplateJson(
      [{ someNumber: 42 }],
      [{ type: 'path', fillColor: '#ffffff', strokeColor: '#000000', data: [] }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as {
      items: { fillColor?: string; strokeColor?: string }[]
    }
    expect(result.items[0]?.fillColor).toBe('#ffffff')
    expect(result.items[0]?.strokeColor).toBe('#000000')
  })

  it('strips non-scalar constants (hex) from the constants array', () => {
    const json = makeTemplateJson(
      [{ background: '#ffffff' }, { offsetX: 10 }],
      [],
    )
    const result = JSON.parse(resolveStringConstants(json)) as { constants: Record<string, unknown>[] }
    expect(result.constants.some(e => 'background' in e)).toBe(false)
    expect(result.constants.some(e => 'offsetX' in e)).toBe(true)
  })

  it('leaves numeric constants in place', () => {
    const json = makeTemplateJson(
      [{ margin: 50 }, { foreground: '#000000' }],
      [],
    )
    const result = JSON.parse(resolveStringConstants(json)) as { constants: Record<string, unknown>[] }
    expect(result.constants.some(e => 'margin' in e)).toBe(true)
    expect(result.constants.some(e => 'foreground' in e)).toBe(false)
  })

  it('leaves scalar string expression constants in place', () => {
    const json = makeTemplateJson(
      [{ halfWidth: 'templateWidth / 2' }, { fg: '#000000' }],
      [],
    )
    const result = JSON.parse(resolveStringConstants(json)) as { constants: Record<string, unknown>[] }
    expect(result.constants.some(e => 'halfWidth' in e)).toBe(true)
    expect(result.constants.some(e => 'fg' in e)).toBe(false)
  })

  it('resolves TextItem text when it exactly matches a non-scalar constant name', () => {
    const json = makeTemplateJson(
      [{ dayLabel: 'Monday' }],
      [{ type: 'text', text: 'dayLabel', x: 0, y: 0, fontSize: 12 }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as { items: { text?: string }[] }
    expect(result.items[0]?.text).toBe('Monday')
  })

  it('does not replace TextItem text that has no matching constant', () => {
    const json = makeTemplateJson(
      [{ foreground: '#000000' }],
      [{ type: 'text', text: 'Hello World', x: 0, y: 0, fontSize: 12 }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as { items: { text?: string }[] }
    expect(result.items[0]?.text).toBe('Hello World')
  })

  it('inlines non-scalar constant name into ScalarValue expression (word-boundary substitution)', () => {
    const json = makeTemplateJson(
      [{ offsetX: 100 }, { labelText: 'Mon' }],
      [{ type: 'path', fillColor: '#000', strokeColor: '#000',
        data: ['M', 'offsetX', 0, 'L', 'labelText', 10] }],
    )
    const result = JSON.parse(resolveStringConstants(json)) as { items: { data?: unknown[] }[] }
    expect(result.items[0]?.data?.[4]).toBe('(Mon)')
    expect(result.items[0]?.data?.[5]).toBe(10)
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
  it('has one item (the bg item)', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false))
    expect(t.items).toHaveLength(1)
  })

  it('bg item is first item with id="bg"', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false))
    expect(t.items[0]?.id).toBe('bg')
  })

  it('bg item has infinite repeat', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false)) as {
      items: { id?: string; repeat?: { rows: unknown; columns: unknown } }[]
    }
    expect(t.items[0]?.repeat?.rows).toBe('infinite')
    expect(t.items[0]?.repeat?.columns).toBe('infinite')
  })

  it('bg item fill references background constant by name', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false)) as {
      items: { id?: string; children?: { fillColor?: string }[] }[]
    }
    expect(t.items[0]?.children?.[0]?.fillColor).toBe(BACKGROUND_CONST)
  })
  it('parses as a valid RemarkableTemplate', () => {
    expect(() => parseTemplate(JSON.parse(buildDefaultTemplate('X', false)))).not.toThrow()
  })
  it('includes foreground constant with black default', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false)) as { constants: Record<string, string>[] }
    const fg = t.constants.find(e => FOREGROUND_CONST in e)?.[FOREGROUND_CONST]
    expect(fg).toBe('#000000')
  })
  it('includes background constant with white default', () => {
    const t = JSON.parse(buildDefaultTemplate('X', false)) as { constants: Record<string, string>[] }
    const bg = t.constants.find(e => BACKGROUND_CONST in e)?.[BACKGROUND_CONST]
    expect(bg).toBe('#ffffff')
  })
})

// ─── injectColorConstants ─────────────────────────────────────────────────────

describe('injectColorConstants', () => {
  const BASE_JSON = JSON.stringify({
    name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
    categories: ['Custom'], orientation: 'portrait', constants: [], items: [],
  })

  it('adds foreground and background constants when absent', () => {
    const result = JSON.parse(injectColorConstants(BASE_JSON)) as { constants: Record<string, string>[] }
    const fg = result.constants.find(e => FOREGROUND_CONST in e)?.[FOREGROUND_CONST]
    const bg = result.constants.find(e => BACKGROUND_CONST in e)?.[BACKGROUND_CONST]
    expect(fg).toBe('#000000')
    expect(bg).toBe('#ffffff')
  })

  it('is idempotent — does not add duplicates', () => {
    const once = injectColorConstants(BASE_JSON)
    const twice = JSON.parse(injectColorConstants(once)) as { constants: Record<string, string>[] }
    const fgCount = twice.constants.filter(e => FOREGROUND_CONST in e).length
    const bgCount = twice.constants.filter(e => BACKGROUND_CONST in e).length
    expect(fgCount).toBe(1)
    expect(bgCount).toBe(1)
  })

  it('does not touch categories', () => {
    const withItems = JSON.stringify({
      name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Custom', 'Dark'], orientation: 'portrait',
      constants: [], items: [{ id: 'bg', type: 'group', boundingBox: { x: 0, y: 0, width: 'templateWidth', height: 'templateHeight' }, repeat: { rows: 'infinite', columns: 'infinite' }, children: [] }],
    })
    const result = JSON.parse(injectColorConstants(withItems)) as {
      categories: string[]
      items: unknown[]
    }
    expect(result.categories).toContain('Dark')
  })

  it('injects bg item when absent', () => {
    const result = JSON.parse(injectColorConstants(BASE_JSON)) as {
      items: { id?: string }[]
    }
    expect(result.items.some(i => i.id === 'bg')).toBe(true)
  })

  it('does not duplicate bg item when already present', () => {
    const withBg = JSON.stringify({
      name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Custom'], orientation: 'portrait',
      constants: [{ [FOREGROUND_CONST]: '#000000' }, { [BACKGROUND_CONST]: '#ffffff' }],
      items: [{ id: 'bg', type: 'group', boundingBox: { x: 0, y: 0, width: 'templateWidth', height: 'templateHeight' }, repeat: { rows: 'infinite', columns: 'infinite' }, children: [] }],
    })
    const result = JSON.parse(injectColorConstants(withBg)) as { items: { id?: string }[] }
    expect(result.items.filter(i => i.id === 'bg')).toHaveLength(1)
  })

  it('does not overwrite existing color constants', () => {
    const withColors = JSON.stringify({
      name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Custom'], orientation: 'portrait',
      constants: [{ [FOREGROUND_CONST]: '#aabbcc' }, { [BACKGROUND_CONST]: '#112233' }],
      items: [],
    })
    const result = JSON.parse(injectColorConstants(withColors)) as { constants: Record<string, string>[] }
    expect(result.constants.find(e => FOREGROUND_CONST in e)?.[FOREGROUND_CONST]).toBe('#aabbcc')
    expect(result.constants.find(e => BACKGROUND_CONST in e)?.[BACKGROUND_CONST]).toBe('#112233')
  })
})

// ─── syncBgItemColor ──────────────────────────────────────────────────────────

describe('syncBgItemColor', () => {
  const makeJsonWithBg = (fill: string) => JSON.stringify({
    name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
    categories: ['Custom'], orientation: 'portrait',
    constants: [{ [BACKGROUND_CONST]: '#000000' }],
    items: [{ ...buildBackgroundItem(), children: [{ type: 'path', fillColor: fill, strokeColor: fill, antialiasing: false, data: [] }] }],
  })

  const makeJsonNoBg = () => JSON.stringify({
    name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
    categories: ['Custom'], orientation: 'portrait',
    constants: [{ [BACKGROUND_CONST]: '#000000' }],
    items: [],
  })

  it('sets bg item fill/stroke to background constant name', () => {
    const json = makeJsonWithBg('#000000')
    const result = JSON.parse(syncBgItemColor(json)) as {
      items: { id?: string; children?: { fillColor?: string }[] }[]
    }
    expect(result.items.find(i => i.id === 'bg')?.children?.[0]?.fillColor).toBe(BACKGROUND_CONST)
  })

  it('is idempotent when fill already references constant name', () => {
    const json = JSON.stringify({
      name: 'T', author: 'a', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Custom'], orientation: 'portrait',
      constants: [{ [BACKGROUND_CONST]: '#ffffff' }],
      items: [buildBackgroundItem()],
    })
    const result = JSON.parse(syncBgItemColor(json)) as {
      items: { id?: string; children?: { fillColor?: string }[] }[]
    }
    expect(result.items.find(i => i.id === 'bg')?.children?.[0]?.fillColor).toBe(BACKGROUND_CONST)
  })

  it('no-op when no bg item present', () => {
    const json = makeJsonNoBg()
    expect(syncBgItemColor(json)).toBe(json)
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
