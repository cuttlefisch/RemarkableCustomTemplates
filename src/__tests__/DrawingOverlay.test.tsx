import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DrawingOverlay } from '../components/DrawingOverlay'
import { initialDrawingEditorState } from '../hooks/useDrawingEditor'
import type { DrawingEditorState } from '../hooks/useDrawingEditor'
import type { PathItem } from '../types/template'

// jsdom doesn't implement getScreenCTM, so we mock it on the prototype
beforeEach(() => {
  // Define getScreenCTM as a function on SVGSVGElement.prototype if not present
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    writable: true,
    value: () => ({
      inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    }),
  })
})

function renderOverlay(overrides: Partial<DrawingEditorState> = {}, items: PathItem[] = []) {
  const dispatch = vi.fn()
  const state = { ...initialDrawingEditorState, ...overrides }
  render(
    <DrawingOverlay
      state={state}
      dispatch={dispatch}
      templateWidth={1404}
      templateHeight={1872}
      items={items}
    />,
  )
  return { dispatch }
}

describe('DrawingOverlay', () => {
  it('renders SVG with correct viewBox', () => {
    renderOverlay()
    const svg = document.querySelector('.drawing-overlay') as SVGSVGElement
    expect(svg.getAttribute('viewBox')).toBe('0 0 1404 1872')
  })

  it('mouse click dispatches CANVAS_CLICK for drawing tools', () => {
    const { dispatch } = renderOverlay({ activeTool: 'point' })
    const svg = document.querySelector('.drawing-overlay')!
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 200 })
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

  it('cursor class changes with active tool', () => {
    renderOverlay({ activeTool: 'line' })
    const svg = document.querySelector('.drawing-overlay') as SVGSVGElement
    expect(svg.style.cursor).toBe('crosshair')
  })

  it('cursor is default for select tool', () => {
    renderOverlay({ activeTool: 'select' })
    const svg = document.querySelector('.drawing-overlay') as SVGSVGElement
    expect(svg.style.cursor).toBe('default')
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
