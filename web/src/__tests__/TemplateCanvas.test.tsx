import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateCanvas } from '../components/TemplateCanvas'
import type { RemarkableTemplate } from '../types/template'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<RemarkableTemplate> = {}): RemarkableTemplate {
  return {
    name: 'Test',
    author: 'test',
    templateVersion: '1.0.0',
    formatVersion: 1,
    categories: ['Lines'],
    orientation: 'portrait',
    constants: [],
    items: [],
    ...overrides,
  }
}

// ─── SVG root ─────────────────────────────────────────────────────────────────

describe('TemplateCanvas SVG root', () => {
  it('renders an svg element', () => {
    const { container } = render(<TemplateCanvas template={makeTemplate()} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('portrait: viewBox is 1404×1872', () => {
    const { container } = render(<TemplateCanvas template={makeTemplate({ orientation: 'portrait' })} />)
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1404 1872')
  })

  it('landscape: viewBox is 1872×1404', () => {
    const { container } = render(
      <TemplateCanvas template={makeTemplate({ orientation: 'landscape' })} />,
    )
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1872 1404')
  })

  it('renders a white background rect', () => {
    const { container } = render(<TemplateCanvas template={makeTemplate()} />)
    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect?.getAttribute('fill')).toBe('white')
  })
})

// ─── Path items ───────────────────────────────────────────────────────────────

describe('TemplateCanvas path items', () => {
  it('renders a path element', () => {
    const template = makeTemplate({
      items: [{ type: 'path', id: 'line1', data: ['M', 0, 100, 'L', 1404, 100] }],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')).not.toBeNull()
  })

  it('path has correct d attribute with resolved constants', () => {
    const template = makeTemplate({
      constants: [{ yHeader: 146 }],
      items: [
        { type: 'path', id: 'line1', data: ['M', 0, 'yHeader', 'L', 'templateWidth', 'yHeader'] },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M 0 146 L 1404 146')
  })

  it('path has correct stroke color', () => {
    const template = makeTemplate({
      items: [
        {
          type: 'path',
          data: ['M', 0, 0, 'L', 10, 10],
          strokeColor: '#ff0000',
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')?.getAttribute('stroke')).toBe('#ff0000')
  })

  it('path fill defaults to none when fillColor not set', () => {
    const template = makeTemplate({
      items: [{ type: 'path', data: ['M', 0, 0, 'L', 10, 10] }],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('none')
  })

  it('path fill uses fillColor when explicitly set', () => {
    const template = makeTemplate({
      items: [
        {
          type: 'path',
          data: ['M', 0, 0, 'L', 1, 0, 'L', 1, 1, 'L', 0, 1, 'Z'],
          fillColor: '#000000',
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('#000000')
  })
})

// ─── Text items ───────────────────────────────────────────────────────────────

describe('TemplateCanvas text items', () => {
  it('renders a text element with correct content', () => {
    const template = makeTemplate({
      items: [
        { type: 'text', text: 'Monday', fontSize: 32, position: { x: 100, y: 200 } },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    const textEl = container.querySelector('text')
    expect(textEl).not.toBeNull()
    expect(textEl?.textContent).toBe('Monday')
  })

  it('text element has correct x and y attributes', () => {
    const template = makeTemplate({
      items: [
        { type: 'text', text: 'Week', fontSize: 72, position: { x: 400, y: 96 } },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    const textEl = container.querySelector('text')
    expect(textEl?.getAttribute('x')).toBe('400')
    expect(textEl?.getAttribute('y')).toBe('96')
  })

  it('text position x resolves expressions using templateWidth', () => {
    // "templateWidth / 2" with portrait templateWidth=1404 → 702
    const template = makeTemplate({
      items: [
        {
          type: 'text',
          text: 'Title',
          fontSize: 48,
          position: { x: 'templateWidth / 2', y: 100 },
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('text')?.getAttribute('x')).toBe('702')
  })

  it('text position x resolves textWidth expression', () => {
    // "templateWidth / 2 - textWidth / 2" centers text
    // templateWidth=1404, textWidth = estimateTextWidth("Week", 72) = 72*0.6*4 = 172.8
    // x = 702 - 86.4 = 615.6
    const template = makeTemplate({
      items: [
        {
          type: 'text',
          text: 'Week',
          fontSize: 72,
          position: { x: 'templateWidth / 2 - textWidth / 2', y: 96 },
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    const x = parseFloat(container.querySelector('text')?.getAttribute('x') ?? 'NaN')
    expect(x).toBeCloseTo(615.6, 0)
  })
})

// ─── Group items ──────────────────────────────────────────────────────────────

describe('TemplateCanvas group items', () => {
  it('no-repeat group renders children exactly once', () => {
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 0, width: 1404, height: 1872 },
          repeat: { rows: 0, columns: 0 },
          children: [
            { type: 'path', id: 'p1', data: ['M', 0, 0, 'L', 100, 0] },
          ],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path')).toHaveLength(1)
  })

  it('no-repeat group applies translate from boundingBox', () => {
    const template = makeTemplate({
      constants: [{ offsetY: 177.8 }],
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 'offsetY', width: 1404, height: 100 },
          repeat: { rows: 0, columns: 0 },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 100, 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    const g = container.querySelector('g')
    expect(g?.getAttribute('transform')).toContain('translate(0, 177.8)')
  })

  it('exact-count repeat renders N groups', () => {
    // rows: 6 → 6 tiles stacked vertically
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 155, width: 1104, height: 284 },
          repeat: { rows: 6 },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 100, 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path')).toHaveLength(6)
  })

  it('"down" repeat fills viewport with multiple rows', () => {
    // tileStart=177.8, tileSize=78.7, viewSize=1872 → 22 tiles
    const template = makeTemplate({
      constants: [{ offsetY: 177.8 }],
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 'offsetY', width: 1404, height: 78.7 },
          repeat: { rows: 'down' },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 'parentWidth', 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path').length).toBe(22)
  })

  it('parentWidth is available as a constant inside tile children', () => {
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 0, width: 1104, height: 78.7 },
          repeat: { rows: 1 },
          children: [{ type: 'path', id: 'myline', data: ['M', 0, 0, 'L', 'parentWidth', 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M 0 0 L 1104 0')
  })

  it('parentHeight is available as a constant inside tile children', () => {
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 0, width: 52, height: 1872 },
          repeat: { columns: 1 },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 0, 'parentHeight'] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M 0 0 L 0 1872')
  })

  it('nested groups work correctly', () => {
    // Outer: rows:2, inner: rows:5 → 10 paths total
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 0, width: 1404, height: 132 },
          repeat: { rows: 2 },
          children: [
            {
              type: 'group',
              boundingBox: { x: 0, y: 0, width: 'parentWidth', height: 18 },
              repeat: { rows: 5 },
              children: [{ type: 'path', data: ['M', 0, 0, 'L', 'parentWidth', 0] }],
            },
          ],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path')).toHaveLength(10)
  })
})

// ─── Integration ──────────────────────────────────────────────────────────────

describe('TemplateCanvas integration', () => {
  it('renders a P Lines-medium-style template with horizontal lines', () => {
    const template: RemarkableTemplate = {
      name: 'Lines medium',
      author: 'reMarkable',
      templateVersion: '1.0.0',
      formatVersion: 1,
      categories: ['Lines'],
      orientation: 'portrait',
      constants: [
        { mobileMaxWidth: 1000 },
        { mobileOffsetY: 160 },
        { magicOffsetY: 177.8 },
        { offsetY: 'templateWidth > mobileMaxWidth ? magicOffsetY : mobileOffsetY' },
      ],
      items: [
        {
          type: 'group',
          boundingBox: {
            x: 'templateWidth / 2 - templateHeight / 2',
            y: 'offsetY',
            width: 'templateHeight',
            height: 78.7,
          },
          repeat: { rows: 'down' },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 'parentWidth', 0] }],
        },
      ],
    }
    const { container } = render(<TemplateCanvas template={template} />)
    // Should produce many line paths
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(10)
    // First path should draw a horizontal line (y stays 0, x goes from 0 to parentWidth)
    expect(paths[0]?.getAttribute('d')).toBe('M 0 0 L 1872 0')
  })

  it('renders a P Week 2-style template with groups and text', () => {
    const template: RemarkableTemplate = {
      name: 'Week planner',
      author: 'reMarkable',
      templateVersion: '1.0.0',
      formatVersion: 1,
      categories: ['Planners'],
      orientation: 'portrait',
      constants: [
        { mobileMaxWidth: 1000 },
        { mobileOffsetY: 75 },
        { offsetY: 'templateWidth > mobileMaxWidth ? 0 : mobileOffsetY' },
        { yHeader: 146 },
      ],
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 'offsetY', width: 'templateWidth', height: 'templateHeight' },
          repeat: { rows: 0, columns: 0 },
          children: [
            {
              type: 'path',
              data: ['M', 0, 'yHeader', 'L', 'templateWidth', 'yHeader'],
            },
            { type: 'text', text: 'Week', fontSize: 72, position: { x: 400, y: 96 } },
            { type: 'text', text: 'Monday', fontSize: 32, position: { x: 200, y: 300 } },
          ],
        },
      ],
    }
    const { container } = render(<TemplateCanvas template={template} />)

    // One path: the horizontal header line
    expect(container.querySelector('path')?.getAttribute('d')).toBe('M 0 146 L 1404 146')

    // Two text elements
    const texts = container.querySelectorAll('text')
    expect(texts).toHaveLength(2)
    expect(texts[0]?.textContent).toBe('Week')
    expect(texts[1]?.textContent).toBe('Monday')
  })
})
