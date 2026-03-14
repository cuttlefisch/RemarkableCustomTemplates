import { describe, it, expect } from 'vitest'
import { parseTemplate } from '../lib/parser'
import { resolveConstants } from '../lib/expression'
import { deviceBuiltins } from '../lib/renderer'
import { resolveStringConstants } from '../lib/customTemplates'
import type { PathItem, GroupItem, TextItem } from '../types/template'
import raw from '../../public/templates/debug/P Debug.template?raw'
import lsRaw from '../../public/templates/debug/LS Debug Landscape.template?raw'

const json = JSON.parse(raw) as { constants: unknown[] }
const lsJson = JSON.parse(lsRaw) as { constants: unknown[] }

describe('Debug.template', () => {
  it('parses without error', () => { expect(() => parseTemplate(json)).not.toThrow() })

  const template = parseTemplate(json)

  it('is portrait orientation', () => { expect(template.orientation).toBe('portrait') })
  it('has at least 25 constants', () => { expect(template.constants.length).toBeGreaterThanOrEqual(25) })
  it('has at least 60 items', () => { expect(template.items.length).toBeGreaterThanOrEqual(60) })

  describe('constant resolution (rm2 portrait)', () => {
    const ctx = resolveConstants(template.constants, deviceBuiltins('portrait'))
    it('cx = 702', () => { expect(ctx.cx).toBe(702) })
    it('cy = 936', () => { expect(ctx.cy).toBe(936) })
    it('gsStep = 148', () => { expect(ctx.gsStep).toBe(148) })
    it('g2Y = gsY + gsH + 20', () => { expect(ctx.g2Y).toBe(ctx.gsY + ctx.gsH + 20) })
    it('g3Y = g2Y + gsH + 20', () => { expect(ctx.g3Y).toBe(ctx.g2Y + ctx.gsH + 20) })
    it('g4Y = g3Y + gsH + 20', () => { expect(ctx.g4Y).toBe(ctx.g3Y + ctx.gsH + 20) })
    it('swY derives from g4Y', () => { expect(ctx.swY).toBe(ctx.g4Y + ctx.gsH + 50) })
    it('gridY > txY + txStep * 5', () => {
      expect(ctx.gridY).toBeGreaterThan(ctx.txY + ctx.txStep * 5)
    })
    it('rlY is within page bounds', () => { expect(ctx.rlY).toBeLessThan(1872 - 60) })
    it('isRm2 = 1 on rm2 portrait', () => { expect(ctx.isRm2).toBe(1) })
  })

  describe('items — features exercised', () => {
    const paths = () => template.items.filter(i => i.type === 'path') as PathItem[]
    const groups = () => template.items.filter(i => i.type === 'group') as GroupItem[]
    const texts = () => template.items.filter(i => i.type === 'text') as TextItem[]

    it('border item exists', () => {
      expect(template.items.find(i => i.id === 'border')).toBeDefined()
    })
    it('title uses textWidth centering', () => {
      const t = template.items.find(i => i.id === 'title') as TextItem
      expect(t?.type).toBe('text')
      expect((t?.position.x as string)).toContain('textWidth')
    })
    it('has all four color ramp sections (gs, r, g, b swatches)', () => {
      expect(template.items.find(i => i.id === 'gs-0')).toBeDefined()
      expect(template.items.find(i => i.id === 'r-5')).toBeDefined()
      expect(template.items.find(i => i.id === 'g-5')).toBeDefined()
      expect(template.items.find(i => i.id === 'b-5')).toBeDefined()
    })
    it('r-5 has fillColor #ff0000', () => {
      const r5 = template.items.find(i => i.id === 'r-5') as PathItem
      expect(r5?.fillColor).toBe('#ff0000')
    })
    it('g-5 has fillColor #00ff00', () => {
      const g5 = template.items.find(i => i.id === 'g-5') as PathItem
      expect(g5?.fillColor).toBe('#00ff00')
    })
    it('b-5 has fillColor #0000ff', () => {
      const b5 = template.items.find(i => i.id === 'b-5') as PathItem
      expect(b5?.fillColor).toBe('#0000ff')
    })
    it('has path with C (bezier) command', () => {
      expect(paths().some(p => p.data.includes('C'))).toBe(true)
    })
    it('has path with antialiasing: false', () => {
      expect(paths().some(p => p.antialiasing === false)).toBe(true)
    })
    it('has path with strokeWidth as expression string', () => {
      expect(paths().some(p => typeof p.strokeWidth === 'string')).toBe(true)
    })
    it('has path with fillColor undefined (no-fill)', () => {
      expect(paths().some(p => p.fillColor === undefined)).toBe(true)
    })
    it('has path with Z command and fillColor (closed + filled)', () => {
      expect(paths().some(p => p.data.includes('Z') && p.fillColor !== undefined)).toBe(true)
    })
    it('has group with repeat rows="down"', () => {
      expect(groups().some(g => g.repeat?.rows === 'down')).toBe(true)
    })
    it('has group with repeat columns="infinite"', () => {
      expect(groups().some(g => g.repeat?.columns === 'infinite')).toBe(true)
    })
    it('has group with exact numeric rows > 1 and columns > 1', () => {
      expect(groups().some(
        g => typeof g.repeat?.rows === 'number' && (g.repeat.rows as number) > 1 &&
             typeof g.repeat?.columns === 'number' && (g.repeat.columns as number) > 1
      )).toBe(true)
    })
    it('grid child uses parentWidth and parentHeight', () => {
      const grid = template.items.find(i => i.id === 'grid') as GroupItem
      const child = grid?.children[0] as PathItem
      expect(child?.data).toContain('parentWidth')
      expect(child?.data).toContain('parentHeight')
    })
    it('vlines uses paperOriginX', () => {
      const vlines = template.items.find(i => i.id === 'vlines') as GroupItem
      expect(vlines?.boundingBox.x).toBe('paperOriginX')
    })
    it('has text items with at least 4 distinct font sizes', () => {
      const sizes = new Set(texts().map(t => t.fontSize))
      expect(sizes.size).toBeGreaterThanOrEqual(4)
    })
  })

  describe('resolveStringConstants', () => {
    it('is a no-op: all constants are scalar', () => {
      const resolved = JSON.parse(resolveStringConstants(raw)) as { constants: unknown[] }
      expect(resolved.constants).toHaveLength(json.constants.length)
    })
  })
})

describe('Debug Landscape.template', () => {
  it('parses without error', () => { expect(() => parseTemplate(lsJson)).not.toThrow() })

  const lsTemplate = parseTemplate(lsJson)

  it('is landscape orientation', () => { expect(lsTemplate.orientation).toBe('landscape') })
  it('has group with columns="infinite"', () => {
    const groups = lsTemplate.items.filter(i => i.type === 'group') as GroupItem[]
    expect(groups.some(g => g.repeat?.columns === 'infinite')).toBe(true)
  })
  it('vlines paperOriginX = 234 in landscape', () => {
    const ctx = resolveConstants(lsTemplate.constants, deviceBuiltins('landscape'))
    expect(ctx.paperOriginX).toBe(234)
    const vlines = lsTemplate.items.find(i => i.id === 'vlines') as GroupItem
    expect(vlines?.boundingBox.x).toBe('paperOriginX')
  })
  it('resolveStringConstants is a no-op', () => {
    const resolved = JSON.parse(resolveStringConstants(lsRaw)) as { constants: unknown[] }
    expect(resolved.constants).toHaveLength(lsJson.constants.length)
  })
})
