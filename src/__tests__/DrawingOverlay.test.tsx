import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DrawingOverlay } from '../components/DrawingOverlay'
import type { IndexedPathItem } from '../components/DrawingOverlay'
import { initialDrawingEditorState } from '../hooks/useDrawingEditor'
import type { DrawingEditorState } from '../hooks/useDrawingEditor'

// jsdom doesn't implement getScreenCTM, so we mock it on the prototype
beforeEach(() => {
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    writable: true,
    value: () => ({
      inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  })
})

function renderOverlay(overrides: Partial<DrawingEditorState> = {}, items: IndexedPathItem[] = []) {
  const dispatch = vi.fn()
  const state = { ...initialDrawingEditorState, ...overrides }
  render(
    <svg viewBox="0 0 1404 1872" xmlns="http://www.w3.org/2000/svg">
      <DrawingOverlay
        state={state}
        dispatch={dispatch}
        templateWidth={1404}
        templateHeight={1872}
        items={items}
      />
    </svg>,
  )
  return { dispatch }
}

describe('DrawingOverlay', () => {
  it('renders a g element with data-drawing attribute', () => {
    renderOverlay()
    const g = document.querySelector('[data-drawing]') as SVGGElement
    expect(g).not.toBeNull()
    expect(g.tagName.toLowerCase()).toBe('g')
  })

  it('renders inside parent SVG (single CTM)', () => {
    renderOverlay()
    const svg = document.querySelector('svg')
    expect(svg).not.toBeNull()
    // The g is a direct child of the test wrapper svg
    const g = document.querySelector('[data-drawing]') as SVGGElement
    expect(g.ownerSVGElement).toBe(svg)
  })

  it('mouse click dispatches CANVAS_CLICK for drawing tools', () => {
    const { dispatch } = renderOverlay({ activeTool: 'point' })
    const g = document.querySelector('[data-drawing]')!
    fireEvent.mouseDown(g, { clientX: 100, clientY: 200 })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'CANVAS_CLICK',
      point: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    })
  })

  it('escape dispatches CANCEL', () => {
    const { dispatch } = renderOverlay({ activeTool: 'polygon' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'CANCEL' })
  })

  it('cursor style changes with active tool', () => {
    renderOverlay({ activeTool: 'line' })
    const g = document.querySelector('[data-drawing]') as SVGGElement
    expect(g.style.cursor).toBe('crosshair')
  })

  it('cursor is default for select tool', () => {
    renderOverlay({ activeTool: 'select' })
    const g = document.querySelector('[data-drawing]') as SVGGElement
    expect(g.style.cursor).toBe('default')
  })

  it('renders in-progress polygon with vertex dots and edges', () => {
    renderOverlay({
      activeTool: 'polygon',
      inProgress: {
        tool: 'polygon',
        vertices: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
        ],
      },
      cursorPos: { x: 150, y: 250 },
    })
    // Should have vertex circles
    const circles = document.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(3)
  })
})
