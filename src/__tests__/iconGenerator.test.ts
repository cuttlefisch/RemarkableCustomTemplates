import { describe, it, expect } from 'vitest'
import { generateTemplateIcon } from '../lib/iconGenerator'
import type { RemarkableTemplate, PathItem, GroupItem, TextItem } from '../types/template'

function makeTemplate(overrides?: Partial<RemarkableTemplate>): RemarkableTemplate {
  return {
    name: 'Test',
    author: '',
    templateVersion: '1',
    formatVersion: 1,
    categories: [],
    orientation: 'portrait',
    constants: [],
    items: [],
    ...overrides,
  }
}

function decode(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf8')
}

// ─── Output format ────────────────────────────────────────────────────────────

describe('output format', () => {
  it('returns a non-empty string', () => {
    const result = generateTemplateIcon(makeTemplate())
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('decodes to a string containing <svg and ending </svg>', () => {
    const svg = decode(generateTemplateIcon(makeTemplate()))
    expect(svg).toContain('<svg')
    expect(svg.trimEnd()).toMatch(/<\/svg>$/)
  })
})

// ─── Icon dimensions — portrait rm2 ──────────────────────────────────────────

describe('icon dimensions — portrait rm2', () => {
  it('SVG has width="150" height="200"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate()))
    expect(svg).toContain('width="150"')
    expect(svg).toContain('height="200"')
  })

  it('SVG has viewBox="0 0 1404 1872"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate()))
    expect(svg).toContain('viewBox="0 0 1404 1872"')
  })
})

// ─── Icon dimensions — landscape rm2 ─────────────────────────────────────────

describe('icon dimensions — landscape rm2', () => {
  it('SVG has width="200" height="150"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate({ orientation: 'landscape' })))
    expect(svg).toContain('width="200"')
    expect(svg).toContain('height="150"')
  })

  it('SVG has viewBox="0 0 1872 1404"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate({ orientation: 'landscape' })))
    expect(svg).toContain('viewBox="0 0 1872 1404"')
  })
})

// ─── Icon dimensions — rmPP ───────────────────────────────────────────────────

describe('icon dimensions — rmPP', () => {
  it('portrait viewBox is "0 0 954 1696"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate(), 'rmPP'))
    expect(svg).toContain('viewBox="0 0 954 1696"')
  })
})

// ─── Background color ─────────────────────────────────────────────────────────

describe('background color', () => {
  it('default (no Dark) → background rect has fill="#ffffff"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate()))
    expect(svg).toContain('fill="#ffffff"')
  })

  it('categories includes Dark → background rect has fill="#000000"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate({ categories: ['Dark'] })))
    expect(svg).toContain('fill="#000000"')
  })

  it('template with background constant → uses that color', () => {
    const svg = decode(
      generateTemplateIcon(
        makeTemplate({ constants: [{ background: '#123456' }] }),
      ),
    )
    expect(svg).toContain('fill="#123456"')
  })
})

// ─── Path rendering ───────────────────────────────────────────────────────────

describe('path rendering', () => {
  const pathItem: PathItem = {
    type: 'path',
    data: ['M', 0, 0, 'L', 100, 100],
  }

  it('PathItem in items → decoded SVG contains <path', () => {
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [pathItem] })))
    expect(svg).toContain('<path')
  })

  it('default strokeColor → stroke="#000000"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [pathItem] })))
    expect(svg).toContain('stroke="#000000"')
  })

  it('default fillColor → fill="none"', () => {
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [pathItem] })))
    expect(svg).toContain('fill="none"')
  })

  it('explicit strokeColor → correct hex in output', () => {
    const item: PathItem = { ...pathItem, strokeColor: '#ff0000' }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [item] })))
    expect(svg).toContain('stroke="#ff0000"')
  })

  it('explicit fillColor → correct hex in output', () => {
    const item: PathItem = { ...pathItem, fillColor: '#00ff00' }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [item] })))
    expect(svg).toContain('fill="#00ff00"')
  })

  it('named strokeColor constant → resolved hex in output', () => {
    const item: PathItem = { ...pathItem, strokeColor: 'lineColor' }
    const svg = decode(
      generateTemplateIcon(
        makeTemplate({
          constants: [{ lineColor: '#aabbcc' }],
          items: [item],
        }),
      ),
    )
    expect(svg).toContain('stroke="#aabbcc"')
  })

  it('strokeWidth: 3 → stroke-width="3"', () => {
    const item: PathItem = { ...pathItem, strokeWidth: 3 }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [item] })))
    expect(svg).toContain('stroke-width="3"')
  })
})

// ─── Text items skipped ───────────────────────────────────────────────────────

describe('text items skipped', () => {
  it('template with only a TextItem → decoded SVG does not contain <text', () => {
    const textItem: TextItem = {
      type: 'text',
      text: 'Hello',
      position: { x: 0, y: 0 },
      fontSize: 12,
    }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [textItem] })))
    expect(svg).not.toContain('<text')
  })
})

// ─── Group rendering ──────────────────────────────────────────────────────────

describe('group rendering', () => {
  const pathChild: PathItem = {
    type: 'path',
    data: ['M', 0, 0, 'L', 10, 0],
  }

  it('group without repeat → exactly one <g transform="translate(0,0)">', () => {
    const group: GroupItem = {
      type: 'group',
      boundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [pathChild],
    }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [group] })))
    const matches = svg.match(/<g transform="translate\(0,0\)">/g)
    expect(matches).toHaveLength(1)
  })

  it('group with repeat rows: "down" → multiple <g transform elements', () => {
    // Tile height = 1872/6 = 312 fills portrait page exactly with 6 rows
    const group: GroupItem = {
      type: 'group',
      boundingBox: { x: 0, y: 0, width: 1404, height: 312 },
      repeat: { rows: 'down' },
      children: [pathChild],
    }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [group] })))
    const matches = svg.match(/<g transform=/g)
    expect(matches!.length).toBeGreaterThan(1)
  })

  it('group with exact repeat rows: 3 → exactly 3 <g transform elements', () => {
    const group: GroupItem = {
      type: 'group',
      boundingBox: { x: 0, y: 0, width: 1404, height: 200 },
      repeat: { rows: 3 },
      children: [pathChild],
    }
    const svg = decode(generateTemplateIcon(makeTemplate({ items: [group] })))
    const matches = svg.match(/<g transform=/g)
    expect(matches).toHaveLength(3)
  })
})

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('calling twice with identical input → identical output strings', () => {
    const template = makeTemplate({
      items: [{ type: 'path', data: ['M', 0, 0, 'L', 100, 100], strokeColor: '#abcdef' }],
    })
    expect(generateTemplateIcon(template)).toBe(generateTemplateIcon(template))
  })
})
