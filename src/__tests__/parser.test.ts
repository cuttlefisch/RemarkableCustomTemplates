import { describe, it, expect } from 'vitest'
import { parseTemplate, serializeTemplate } from '../lib/parser'
import type { GroupItem, PathItem, TextItem } from '../types/template'

const MINIMAL_TEMPLATE = {
  name: 'Test',
  author: 'test',
  templateVersion: '1.0.0',
  formatVersion: 1,
  categories: ['Lines'],
  orientation: 'portrait',
  constants: [],
  items: [],
}

describe('parseTemplate', () => {
  it('parses a minimal valid template', () => {
    const result = parseTemplate(MINIMAL_TEMPLATE)
    expect(result.name).toBe('Test')
    expect(result.orientation).toBe('portrait')
    expect(result.items).toEqual([])
    expect(result.constants).toEqual([])
  })

  it('throws on non-object input', () => {
    expect(() => parseTemplate('not an object')).toThrow()
    expect(() => parseTemplate(null)).toThrow()
    expect(() => parseTemplate(42)).toThrow()
  })

  it('throws when a required string field is missing', () => {
    const { name: _name, ...withoutName } = MINIMAL_TEMPLATE
    expect(() => parseTemplate(withoutName)).toThrow(/name/)
  })

  it('throws on invalid orientation', () => {
    expect(() => parseTemplate({ ...MINIMAL_TEMPLATE, orientation: 'sideways' })).toThrow(
      /orientation/i,
    )
  })

  it('parses a text item', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      items: [
        {
          type: 'text',
          id: 'txt1',
          text: 'Monday',
          fontSize: 32,
          position: { x: 10, y: 20 },
        },
      ],
    }
    const result = parseTemplate(raw)
    const item = result.items[0] as TextItem
    expect(item.type).toBe('text')
    expect(item.text).toBe('Monday')
    expect(item.fontSize).toBe(32)
    expect(item.position).toEqual({ x: 10, y: 20 })
  })

  it('parses a text item with expression values', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      items: [
        {
          type: 'text',
          text: 'Week',
          fontSize: 72,
          position: { x: 'templateWidth / 2 - textWidth / 2', y: 96 },
        },
      ],
    }
    const result = parseTemplate(raw)
    const item = result.items[0] as TextItem
    expect(item.position.x).toBe('templateWidth / 2 - textWidth / 2')
    expect(typeof item.id).toBe('string')
  })

  it('auto-assigns id when missing', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      items: [{ type: 'text', text: 'Hi', fontSize: 12, position: { x: 0, y: 0 } }],
    }
    const result = parseTemplate(raw)
    expect(result.items[0].id).toBeTruthy()
  })

  it('parses a path item with defaults', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      items: [
        {
          type: 'path',
          id: 'lines',
          data: ['M', 0, 100, 'L', 1404, 100],
        },
      ],
    }
    const result = parseTemplate(raw)
    const item = result.items[0] as PathItem
    expect(item.type).toBe('path')
    expect(item.data).toEqual(['M', 0, 100, 'L', 1404, 100])
    expect(item.strokeColor).toBe('#000000')
    expect(item.fillColor).toBeUndefined() // no fillColor in source → undefined (renders as fill="none")
    expect(item.strokeWidth).toBe(1)
  })

  it('parses a group item with nested children', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      items: [
        {
          type: 'group',
          id: 'outer',
          boundingBox: { x: 0, y: 0, width: 1404, height: 1872 },
          children: [
            { type: 'text', text: 'Hello', fontSize: 12, position: { x: 0, y: 0 } },
          ],
        },
      ],
    }
    const result = parseTemplate(raw)
    const group = result.items[0] as GroupItem
    expect(group.type).toBe('group')
    expect(group.children).toHaveLength(1)
    expect(group.children[0].type).toBe('text')
  })

  it('throws on unknown item type', () => {
    expect(() =>
      parseTemplate({ ...MINIMAL_TEMPLATE, items: [{ type: 'circle' }] }),
    ).toThrow(/unknown item type/i)
  })

  it('parses constants array', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      constants: [{ yHeader: 146 }, { yDays: 'yHeader + 77' }],
    }
    const result = parseTemplate(raw)
    expect(result.constants).toHaveLength(2)
    expect(result.constants[0]).toEqual({ yHeader: 146 })
  })

  it('parses a group with an empty children array', () => {
    const raw = {
      ...MINIMAL_TEMPLATE,
      items: [{ type: 'group',
                boundingBox: { x: 0, y: 0, width: 100, height: 100 },
                children: [] }],
    }
    const result = parseTemplate(raw)
    expect((result.items[0] as GroupItem).children).toEqual([])
  })

  it('throws when group is missing boundingBox', () => {
    expect(() => parseTemplate({
      ...MINIMAL_TEMPLATE,
      items: [{ type: 'group', children: [] }],
    })).toThrow(/boundingBox/)
  })

  it('round-trips through serialize without data loss', () => {
    const parsed = parseTemplate(MINIMAL_TEMPLATE)
    const serialized = serializeTemplate(parsed)
    const reparsed = parseTemplate(serialized)
    expect(reparsed.name).toBe(parsed.name)
    expect(reparsed.orientation).toBe(parsed.orientation)
  })
})
