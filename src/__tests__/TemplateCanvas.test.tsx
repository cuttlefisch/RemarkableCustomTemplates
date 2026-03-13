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

  it('renders a white background rect for non-dark template', () => {
    const { container } = render(<TemplateCanvas template={makeTemplate()} />)
    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect?.getAttribute('fill')).toBe('#ffffff')
  })

  it('renders a black background rect for Dark category', () => {
    const { container } = render(
      <TemplateCanvas template={makeTemplate({ categories: ['Dark'] })} />,
    )
    const rect = container.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect?.getAttribute('fill')).toBe('#000000')
  })

  it('forwards className prop to the root svg element', () => {
    const { container } = render(
      <TemplateCanvas template={makeTemplate()} className="my-canvas" />
    )
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('my-canvas')
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

  it('repeat count from a constant expression renders the correct number of tiles', () => {
    // P Guitar chords uses repeat: { columns: "columns" } where "columns" is a constant
    // that resolves to 4 (RM2) or 2 (rmPP). Verifies string expressions in repeat values.
    const template = makeTemplate({
      constants: [{ colCount: 3 }],
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 0, width: 200, height: 100 },
          repeat: { columns: 'colCount' },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 100, 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path')).toHaveLength(3)
  })

  it('"infinite" repeat renders tiles on both sides of origin', () => {
    // boundingBox x=200, width=100, columns='infinite', viewWidth=1404
    // firstTile = floor((0-200)/100) = -2
    // lastTile  = ceil((1404-200)/100) - 1 = ceil(12.04) - 1 = 12
    // count = 12 - (-2) + 1 = 15
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 200, y: 0, width: 100, height: 100 },
          repeat: { columns: 'infinite' },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 100, 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path')).toHaveLength(15)
  })

  it('"up" repeat fills only upward from anchor', () => {
    // boundingBox y=936, height=78, rows='up', viewHeight=1872
    // firstTile = floor((0-936)/78) = floor(-12) = -12
    // count = max(1, 0 - (-12) + 1) = 13
    const template = makeTemplate({
      items: [
        {
          type: 'group',
          boundingBox: { x: 0, y: 936, width: 1404, height: 78 },
          repeat: { rows: 'up' },
          children: [{ type: 'path', data: ['M', 0, 0, 'L', 100, 0] }],
        },
      ],
    })
    const { container } = render(<TemplateCanvas template={template} />)
    expect(container.querySelectorAll('path')).toHaveLength(13)
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

// ─── Debug template ───────────────────────────────────────────────────────────
//
// Mirrors public/templates/Debug.template exactly.
// If you change the template file, update this fixture and the assertions below.
//
// Constants (RM2 portrait: templateWidth=1404, templateHeight=1872):
//   margin=50, crossSize=30, lineSpacing=100, mobileMaxWidth=1000
//   headerY: 1404<1000 || 1872<1000 → false → 100
//
// Expected SVG values:
//   border d:      M 50 50 L 1354 50 L 1354 1822 L 50 1822 Z
//   crosshair-h d: M 672 936 L 732 936
//   crosshair-v d: M 702 906 L 702 966
//   title text:    "Debug", x=630 (702 - textWidth/2 = 702 - 72), y=100
//   hlines count:  tileStart=150, tileSize=100, viewSize=1872 → 18 lines
//   total paths:   border + crosshair-h + crosshair-v + 18 hlines = 21

// ─── Debug template fixtures ──────────────────────────────────────────────────
//
// These fixtures mirror the public template files exactly.
// If you change a public template file, update the matching fixture here.
//
// RM2 portrait builtins: templateWidth=1404, templateHeight=1872, paperOriginX=-234
// RM2 landscape builtins: templateWidth=1872, templateHeight=1404, paperOriginX=234

const DEBUG_PORTRAIT_ITEMS: RemarkableTemplate['items'] = [
  {
    id: 'border',
    type: 'path',
    data: ['M', 'margin', 'margin',
           'L', 'templateWidth - margin', 'margin',
           'L', 'templateWidth - margin', 'templateHeight - margin',
           'L', 'margin', 'templateHeight - margin', 'Z'],
    strokeColor: '#ff0000',
    strokeWidth: 3,
  },
  {
    id: 'diagonal-tl-br',
    type: 'path',
    data: ['M', 'margin', 'margin', 'L', 'templateWidth - margin', 'templateHeight - margin'],
    strokeColor: '#888888',
    strokeWidth: 1,
  },
  {
    id: 'diagonal-tr-bl',
    type: 'path',
    data: ['M', 'templateWidth - margin', 'margin', 'L', 'margin', 'templateHeight - margin'],
    strokeColor: '#888888',
    strokeWidth: 1,
  },
  {
    id: 'crosshair-h',
    type: 'path',
    data: ['M', 'templateWidth / 2 - crossSize', 'templateHeight / 2',
           'L', 'templateWidth / 2 + crossSize', 'templateHeight / 2'],
    strokeColor: '#0000ff',
    strokeWidth: 2,
  },
  {
    id: 'crosshair-v',
    type: 'path',
    data: ['M', 'templateWidth / 2', 'templateHeight / 2 - crossSize',
           'L', 'templateWidth / 2', 'templateHeight / 2 + crossSize'],
    strokeColor: '#0000ff',
    strokeWidth: 2,
  },
  {
    id: 'title',
    type: 'text',
    text: 'Debug',
    fontSize: 48,
    position: { x: 'templateWidth / 2 - textWidth / 2', y: 'headerY' },
  },
  {
    id: 'font-sm',
    type: 'text',
    text: 'size 24',
    fontSize: 24,
    position: { x: 'margin + 10', y: 'headerY + 60' },
  },
  {
    id: 'font-md',
    type: 'text',
    text: 'size 48',
    fontSize: 48,
    position: { x: 'margin + 10', y: 'headerY + 140' },
  },
  {
    id: 'font-lg',
    type: 'text',
    text: 'size 72',
    fontSize: 72,
    position: { x: 'margin + 10', y: 'headerY + 260' },
  },
  // ── E-ink color calibration swatches ──────────────────────────────────────
  // 9 filled rectangles across the page; each uses expression arithmetic for x.
  // swatchY = headerY + 360 = 460, swatchSize = 80, swatchStep = 90, margin = 50
  // Grayscale ramp validates tonal range; primaries/secondaries validate color gamut.
  {
    id: 'color-black',
    type: 'path',
    data: ['M', 'margin + swatchStep * 0', 'swatchY',
           'L', 'margin + swatchStep * 0 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 0 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 0', 'swatchY + swatchSize', 'Z'],
    fillColor: '#000000', strokeColor: '#000000',
  },
  {
    id: 'color-dkgray',
    type: 'path',
    data: ['M', 'margin + swatchStep * 1', 'swatchY',
           'L', 'margin + swatchStep * 1 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 1 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 1', 'swatchY + swatchSize', 'Z'],
    fillColor: '#555555', strokeColor: '#555555',
  },
  {
    id: 'color-ltgray',
    type: 'path',
    data: ['M', 'margin + swatchStep * 2', 'swatchY',
           'L', 'margin + swatchStep * 2 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 2 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 2', 'swatchY + swatchSize', 'Z'],
    fillColor: '#aaaaaa', strokeColor: '#aaaaaa',
  },
  {
    id: 'color-white',
    type: 'path',
    data: ['M', 'margin + swatchStep * 3', 'swatchY',
           'L', 'margin + swatchStep * 3 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 3 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 3', 'swatchY + swatchSize', 'Z'],
    fillColor: '#ffffff', strokeColor: '#888888',
  },
  {
    id: 'color-red',
    type: 'path',
    data: ['M', 'margin + swatchStep * 4', 'swatchY',
           'L', 'margin + swatchStep * 4 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 4 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 4', 'swatchY + swatchSize', 'Z'],
    fillColor: '#ff0000', strokeColor: '#ff0000',
  },
  {
    id: 'color-orange',
    type: 'path',
    data: ['M', 'margin + swatchStep * 5', 'swatchY',
           'L', 'margin + swatchStep * 5 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 5 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 5', 'swatchY + swatchSize', 'Z'],
    fillColor: '#ff8800', strokeColor: '#ff8800',
  },
  {
    id: 'color-yellow',
    type: 'path',
    data: ['M', 'margin + swatchStep * 6', 'swatchY',
           'L', 'margin + swatchStep * 6 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 6 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 6', 'swatchY + swatchSize', 'Z'],
    fillColor: '#ffff00', strokeColor: '#888888',
  },
  {
    id: 'color-green',
    type: 'path',
    data: ['M', 'margin + swatchStep * 7', 'swatchY',
           'L', 'margin + swatchStep * 7 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 7 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 7', 'swatchY + swatchSize', 'Z'],
    fillColor: '#00aa00', strokeColor: '#00aa00',
  },
  {
    id: 'color-blue',
    type: 'path',
    data: ['M', 'margin + swatchStep * 8', 'swatchY',
           'L', 'margin + swatchStep * 8 + swatchSize', 'swatchY',
           'L', 'margin + swatchStep * 8 + swatchSize', 'swatchY + swatchSize',
           'L', 'margin + swatchStep * 8', 'swatchY + swatchSize', 'Z'],
    fillColor: '#0000ff', strokeColor: '#0000ff',
  },
  // ── Ruled lines (background grid) ─────────────────────────────────────────
  {
    id: 'hlines',
    type: 'group',
    boundingBox: {
      x: 'margin',
      y: 'margin + lineSpacing',
      width: 'templateWidth - margin * 2',
      height: 'lineSpacing',
    },
    repeat: { rows: 'down' },
    children: [
      { type: 'path', data: ['M', 0, 0, 'L', 'parentWidth', 0], strokeColor: '#cccccc', strokeWidth: 1 },
    ],
  },
]

const DEBUG_CONSTANTS: RemarkableTemplate['constants'] = [
  { margin: 50 },
  { crossSize: 30 },
  { lineSpacing: 100 },
  { mobileMaxWidth: 1000 },
  { headerY: 'templateWidth < mobileMaxWidth || templateHeight < mobileMaxWidth ? 50 : 100' },
  { swatchSize: 80 },
  { swatchStep: 90 },           // swatchSize + 10px gap
  { swatchY: 'headerY + 360' }, // below font samples
]

const DEBUG_TEMPLATE: RemarkableTemplate = {
  name: 'Debug',
  author: 'test',
  templateVersion: '1.0.0',
  formatVersion: 1,
  categories: ['Creative'],
  orientation: 'portrait',
  constants: DEBUG_CONSTANTS,
  items: DEBUG_PORTRAIT_ITEMS,
}

const DEBUG_LANDSCAPE_TEMPLATE: RemarkableTemplate = {
  name: 'Debug Landscape',
  author: 'test',
  templateVersion: '1.0.0',
  formatVersion: 1,
  categories: ['Creative'],
  orientation: 'landscape',
  constants: DEBUG_CONSTANTS,
  items: [
    ...DEBUG_PORTRAIT_ITEMS,
    // Extra: vertical lines using paperOriginX — landscape-specific feature
    {
      id: 'vlines',
      type: 'group',
      boundingBox: {
        x: 'paperOriginX',
        y: 0,
        width: 'lineSpacing',
        height: 'templateHeight',
      },
      repeat: { columns: 'infinite' },
      children: [
        { type: 'path', data: ['M', 0, 0, 'L', 0, 'parentHeight'], strokeColor: '#cccccc', strokeWidth: 1 },
      ],
    },
  ],
}

// ─── Portrait debug template ──────────────────────────────────────────────────
//
// RM2 portrait: templateWidth=1404, templateHeight=1872
//   margin=50, crossSize=30, lineSpacing=100, mobileMaxWidth=1000
//   headerY: 1404<1000 || 1872<1000 → false → 100
//   swatchSize=80, swatchStep=90, swatchY: headerY+360 = 460
//
//   border d:           M 50 50 L 1354 50 L 1354 1822 L 50 1822 Z
//   diagonal-tl-br d:  M 50 50 L 1354 1822
//   diagonal-tr-bl d:  M 1354 50 L 50 1822
//   crosshair-h d:     M 672 936 L 732 936  (702±30, 1872/2=936)
//   crosshair-v d:     M 702 906 L 702 966  (936±30, 1404/2=702)
//   title:             x=630 (702-72), y=100
//   font-sm:           x=60, y=160, fontSize=24
//   font-md:           x=60, y=240, fontSize=48
//   font-lg:           x=60, y=360, fontSize=72
//   color-black d:     M 50 460 L 130 460 L 130 540 L 50 540 Z
//   color-blue d:      M 770 460 L 850 460 L 850 540 L 770 540 Z
//   hlines count:      tileStart=150, tileSize=100, viewSize=1872 → 18
//   total paths:       5 standalone + 9 swatches + 18 hlines = 32

describe('TemplateCanvas portrait debug template', () => {
  it('renders without error and produces an SVG', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('viewBox is portrait 1404×1872', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1404 1872')
  })

  it('border path spans margin inset on all sides', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#border')?.getAttribute('d'))
      .toBe('M 50 50 L 1354 50 L 1354 1822 L 50 1822 Z')
  })

  it('diagonal top-left → bottom-right', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#diagonal-tl-br')?.getAttribute('d'))
      .toBe('M 50 50 L 1354 1822')
  })

  it('diagonal top-right → bottom-left', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#diagonal-tr-bl')?.getAttribute('d'))
      .toBe('M 1354 50 L 50 1822')
  })

  it('crosshair-h is centered at (702, 936) with ±30 extent', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#crosshair-h')?.getAttribute('d'))
      .toBe('M 672 936 L 732 936')
  })

  it('crosshair-v is centered at (702, 936) with ±30 extent', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#crosshair-v')?.getAttribute('d'))
      .toBe('M 702 906 L 702 966')
  })

  it('headerY resolves to 100 via || ternary (1404<1000 || 1872<1000 → false)', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#title')?.getAttribute('y')).toBe('100')
  })

  it('title is horizontally centered: x = 702 - textWidth("Debug",48)/2 = 630', () => {
    // estimateTextWidth("Debug", 48) = 48 * 0.6 * 5 = 144 → 702 - 72 = 630
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#title')?.getAttribute('x')).toBe('630')
  })

  it('font samples render at correct sizes and y positions', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    const sm = container.querySelector('#font-sm')
    const md = container.querySelector('#font-md')
    const lg = container.querySelector('#font-lg')
    // y = headerY + offset = 100 + offset
    expect(sm?.getAttribute('font-size')).toBe('24')
    expect(sm?.getAttribute('y')).toBe('160')   // headerY + 60
    expect(md?.getAttribute('font-size')).toBe('48')
    expect(md?.getAttribute('y')).toBe('240')   // headerY + 140
    expect(lg?.getAttribute('font-size')).toBe('72')
    expect(lg?.getAttribute('y')).toBe('360')   // headerY + 260
  })

  it('font samples are left-aligned at x = margin + 10 = 60', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#font-sm')?.getAttribute('x')).toBe('60')
    expect(container.querySelector('#font-md')?.getAttribute('x')).toBe('60')
    expect(container.querySelector('#font-lg')?.getAttribute('x')).toBe('60')
  })

  it('color swatches: first (black) and last (blue) have correct d attributes', () => {
    // swatchY=460, swatchSize=80, swatchStep=90, margin=50
    // black: i=0 → x=50,  right=130,  d="M 50 460 L 130 460 L 130 540 L 50 540 Z"
    // blue:  i=8 → x=770, right=850,  d="M 770 460 L 850 460 L 850 540 L 770 540 Z"
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#color-black')?.getAttribute('d'))
      .toBe('M 50 460 L 130 460 L 130 540 L 50 540 Z')
    expect(container.querySelector('#color-blue')?.getAttribute('d'))
      .toBe('M 770 460 L 850 460 L 850 540 L 770 540 Z')
  })

  it('color swatches: fill colors are set correctly for all 9 swatches', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    expect(container.querySelector('#color-black')?.getAttribute('fill')).toBe('#000000')
    expect(container.querySelector('#color-white')?.getAttribute('fill')).toBe('#ffffff')
    expect(container.querySelector('#color-red')?.getAttribute('fill')).toBe('#ff0000')
    expect(container.querySelector('#color-orange')?.getAttribute('fill')).toBe('#ff8800')
    expect(container.querySelector('#color-yellow')?.getAttribute('fill')).toBe('#ffff00')
    expect(container.querySelector('#color-green')?.getAttribute('fill')).toBe('#00aa00')
    expect(container.querySelector('#color-blue')?.getAttribute('fill')).toBe('#0000ff')
  })

  it('hlines "down" fills from y=150 downward: 18 lines', () => {
    // tileStart=150, tileSize=100, viewSize=1872 → count=18
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    // 5 standalone + 9 swatches + 18 hlines = 32 total paths
    expect(container.querySelectorAll('path')).toHaveLength(32)
  })

  it('hlines child paths span parentWidth = templateWidth - margin*2 = 1304', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_TEMPLATE} />)
    const hlinePaths = Array.from(container.querySelectorAll('path'))
      .filter(p => p.getAttribute('d') === 'M 0 0 L 1304 0')
    expect(hlinePaths).toHaveLength(18)
  })
})

// ─── Landscape debug template ─────────────────────────────────────────────────
//
// RM2 landscape: templateWidth=1872, templateHeight=1404, paperOriginX=234
//   Same constants as portrait; headerY: 1872<1000 || 1404<1000 → false → 100
//
//   border d:           M 50 50 L 1822 50 L 1822 1354 L 50 1354 Z
//   diagonal-tl-br d:  M 50 50 L 1822 1354
//   diagonal-tr-bl d:  M 1822 50 L 50 1354
//   crosshair-h d:     M 906 702 L 966 702  (936±30, 1404/2=702)
//   crosshair-v d:     M 936 672 L 936 732  (702±30, 1872/2=936)
//   title:             x=864 (936-72), y=100
//   font-sm:           x=60, y=160, fontSize=24
//   font-md:           x=60, y=240, fontSize=48
//   font-lg:           x=60, y=360, fontSize=72
//   swatches:          same 9 as portrait (same constants, same positions)
//   hlines count:      tileStart=150, tileSize=100, viewSize=1404 → 13
//   vlines count:      tileStart=234, tileSize=100, viewSize=1872 → 20
//     firstTile = floor((0-234)/100) = floor(-2.34) = -3
//     lastTile  = ceil((1872-234)/100) - 1 = ceil(16.38) - 1 = 16
//     count = 16 - (-3) + 1 = 20
//   total paths:       5 standalone + 9 swatches + 13 hlines + 20 vlines = 47

describe('TemplateCanvas landscape debug template', () => {
  it('renders without error and produces an SVG', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('viewBox is landscape 1872×1404', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1872 1404')
  })

  it('border path uses landscape dimensions', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('#border')?.getAttribute('d'))
      .toBe('M 50 50 L 1822 50 L 1822 1354 L 50 1354 Z')
  })

  it('diagonals span the landscape page corners', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('#diagonal-tl-br')?.getAttribute('d')).toBe('M 50 50 L 1822 1354')
    expect(container.querySelector('#diagonal-tr-bl')?.getAttribute('d')).toBe('M 1822 50 L 50 1354')
  })

  it('crosshair-h is at landscape center (936, 702) with ±30 extent', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    // templateWidth/2=936, templateHeight/2=702
    expect(container.querySelector('#crosshair-h')?.getAttribute('d'))
      .toBe('M 906 702 L 966 702')
  })

  it('crosshair-v is at landscape center (936, 702) with ±30 extent', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('#crosshair-v')?.getAttribute('d'))
      .toBe('M 936 672 L 936 732')
  })

  it('title is horizontally centered in landscape: x = 936 - 72 = 864', () => {
    // estimateTextWidth("Debug", 48) = 144 → 936 - 72 = 864
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('#title')?.getAttribute('x')).toBe('864')
  })

  it('headerY still resolves to 100 (1872<1000 || 1404<1000 → false)', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('#title')?.getAttribute('y')).toBe('100')
  })

  it('color swatches render identically in landscape (same constants)', () => {
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    expect(container.querySelector('#color-black')?.getAttribute('d'))
      .toBe('M 50 460 L 130 460 L 130 540 L 50 540 Z')
    expect(container.querySelector('#color-blue')?.getAttribute('d'))
      .toBe('M 770 460 L 850 460 L 850 540 L 770 540 Z')
  })

  it('hlines "down" fills landscape height: 13 lines', () => {
    // tileStart=150, tileSize=100, viewSize=1404 → count=13
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    // 5 standalone + 9 swatches + 13 hlines + 20 vlines = 47 total
    expect(container.querySelectorAll('path')).toHaveLength(47)
  })

  it('vlines use paperOriginX=234: 20 columns covering the viewport', () => {
    // tileStart=234, tileSize=100, viewSize=1872
    // firstTile=floor(-2.34)=-3, lastTile=ceil(16.38)-1=16, count=20
    const { container } = render(<TemplateCanvas template={DEBUG_LANDSCAPE_TEMPLATE} />)
    const vlinePaths = Array.from(container.querySelectorAll('path'))
      .filter(p => p.getAttribute('d') === 'M 0 0 L 0 1404')
    expect(vlinePaths).toHaveLength(20)
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
