import { describe, it, expect } from 'vitest'
import { drawingEditorReducer, initialDrawingEditorState } from '../hooks/useDrawingEditor'
import type { DrawingEditorState, DrawingAction } from '../hooks/useDrawingEditor'

function dispatch(state: DrawingEditorState, action: DrawingAction): DrawingEditorState {
  return drawingEditorReducer(state, action)
}

// ─── Initial state ───────────────────────────────────────────────────────────

describe('initialDrawingEditorState', () => {
  it('defaults to select tool', () => {
    expect(initialDrawingEditorState.activeTool).toBe('select')
  })

  it('defaults to proportional scaling for rm', () => {
    expect(initialDrawingEditorState.scalingMode).toEqual({
      type: 'proportional',
      baseWidth: 1404,
      baseHeight: 1872,
    })
  })

  it('has no in-progress shape', () => {
    expect(initialDrawingEditorState.inProgress).toBeNull()
  })

  it('has no selection', () => {
    expect(initialDrawingEditorState.selectedItemIndex).toBeNull()
  })

  it('has default stroke properties', () => {
    expect(initialDrawingEditorState.strokeColor).toBe('#000000')
    expect(initialDrawingEditorState.strokeWidth).toBe(2)
  })

  it('has fill disabled by default', () => {
    expect(initialDrawingEditorState.fillEnabled).toBe(false)
  })

  it('has no committed item', () => {
    expect(initialDrawingEditorState.committedItem).toBeNull()
  })
})

// ─── SET_TOOL ────────────────────────────────────────────────────────────────

describe('SET_TOOL', () => {
  it('changes active tool', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'point' })
    expect(state.activeTool).toBe('point')
  })

  it('clears inProgress when switching tools', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'line' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.inProgress).not.toBeNull()
    state = dispatch(state, { type: 'SET_TOOL', tool: 'point' })
    expect(state.inProgress).toBeNull()
  })

  it('clears selection when switching to drawing tool', () => {
    let state: DrawingEditorState = { ...initialDrawingEditorState, selectedItemIndex: 2 }
    state = dispatch(state, { type: 'SET_TOOL', tool: 'line' })
    expect(state.selectedItemIndex).toBeNull()
  })
})

// ─── Point tool ──────────────────────────────────────────────────────────────

describe('Point tool', () => {
  it('single click commits a point item', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'point' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 500, y: 500 } })
    expect(state.committedItem).not.toBeNull()
    expect(state.committedItem!.type).toBe('path')
    expect(state.inProgress).toBeNull()
  })
})

// ─── Line tool ───────────────────────────────────────────────────────────────

describe('Line tool', () => {
  it('first click stores start point', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'line' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.inProgress).toEqual({ tool: 'line', vertices: [{ x: 100, y: 200 }] })
    expect(state.committedItem).toBeNull()
  })

  it('second click commits line item', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'line' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 300, y: 400 } })
    expect(state.committedItem).not.toBeNull()
    expect(state.committedItem!.type).toBe('path')
    expect(state.inProgress).toBeNull()
  })
})

// ─── Polygon tool ────────────────────────────────────────────────────────────

describe('Polygon tool', () => {
  it('accumulates vertices on clicks', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'polygon' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    expect(state.inProgress!.vertices).toHaveLength(2)
    expect(state.committedItem).toBeNull()
  })

  it('closes and commits when clicking near first vertex (3+ vertices)', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'polygon' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 100 } })
    // Click near first vertex to close
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 2, y: 2 } })
    expect(state.committedItem).not.toBeNull()
    expect(state.inProgress).toBeNull()
  })

  it('does not close with fewer than 3 vertices', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'polygon' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    // Click near first vertex — not enough vertices to close
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 2, y: 2 } })
    expect(state.committedItem).toBeNull()
    expect(state.inProgress!.vertices).toHaveLength(2)
  })

  it('CANCEL clears inProgress', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'polygon' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    state = dispatch(state, { type: 'CANCEL' })
    expect(state.inProgress).toBeNull()
    expect(state.committedItem).toBeNull()
  })
})

// ─── Regular polygon tool ────────────────────────────────────────────────────

describe('Regular polygon tool', () => {
  it('first click sets center', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'regularPolygon' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 500, y: 500 } })
    expect(state.inProgress).toEqual({ tool: 'regularPolygon', vertices: [{ x: 500, y: 500 }] })
  })

  it('second click commits with radius from distance', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'regularPolygon' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 500, y: 500 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 600, y: 500 } })
    expect(state.committedItem).not.toBeNull()
    expect(state.inProgress).toBeNull()
  })
})

// ─── Property changes ────────────────────────────────────────────────────────

describe('Property changes', () => {
  it('SET_FILL_ENABLED updates fillEnabled', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_FILL_ENABLED', enabled: true })
    expect(state.fillEnabled).toBe(true)
  })

  it('SET_FILL_COLOR updates fillColor', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_FILL_COLOR', color: '#ff0000' })
    expect(state.fillColor).toBe('#ff0000')
  })

  it('SET_STROKE_COLOR updates strokeColor', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_STROKE_COLOR', color: '#0000ff' })
    expect(state.strokeColor).toBe('#0000ff')
  })

  it('SET_STROKE_WIDTH updates strokeWidth', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_STROKE_WIDTH', width: 5 })
    expect(state.strokeWidth).toBe(5)
  })

  it('SET_REGULAR_SIDES updates regularPolygonSides', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_REGULAR_SIDES', sides: 8 })
    expect(state.regularPolygonSides).toBe(8)
  })
})

// ─── CANVAS_MOUSE_MOVE ──────────────────────────────────────────────────────

describe('CANVAS_MOUSE_MOVE', () => {
  it('updates cursorPos', () => {
    const state = dispatch(initialDrawingEditorState, {
      type: 'CANVAS_MOUSE_MOVE',
      point: { x: 123, y: 456 },
    })
    expect(state.cursorPos).toEqual({ x: 123, y: 456 })
  })
})

// ─── Scaling mode ────────────────────────────────────────────────────────────

describe('SET_SCALING_MODE', () => {
  it('changes scaling mode', () => {
    const state = dispatch(initialDrawingEditorState, {
      type: 'SET_SCALING_MODE',
      mode: { type: 'fixed' },
    })
    expect(state.scalingMode).toEqual({ type: 'fixed' })
  })

  it('scaling mode persists across shapes', () => {
    let state = dispatch(initialDrawingEditorState, {
      type: 'SET_SCALING_MODE',
      mode: { type: 'fixed' },
    })
    state = dispatch(state, { type: 'SET_TOOL', tool: 'point' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.scalingMode).toEqual({ type: 'fixed' })
    // The committed item should have numeric (not expression) data
    expect(state.committedItem).not.toBeNull()
    const data = state.committedItem!.data
    const hasExpressions = data.some(t => typeof t === 'string' && t.includes('drawnScale'))
    expect(hasExpressions).toBe(false)
  })
})

// ─── CLEAR_COMMITTED ─────────────────────────────────────────────────────────

describe('CLEAR_COMMITTED', () => {
  it('clears the committed item', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'point' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.committedItem).not.toBeNull()
    state = dispatch(state, { type: 'CLEAR_COMMITTED' })
    expect(state.committedItem).toBeNull()
  })
})

// ─── SELECT_ITEM ─────────────────────────────────────────────────────────────

describe('SELECT_ITEM', () => {
  it('sets selectedItemIndex', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SELECT_ITEM', index: 3 })
    expect(state.selectedItemIndex).toBe(3)
  })

  it('deselects with null', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SELECT_ITEM', index: 3 })
    state = dispatch(state, { type: 'SELECT_ITEM', index: null })
    expect(state.selectedItemIndex).toBeNull()
  })
})

// ─── DELETE_SELECTED ─────────────────────────────────────────────────────────

describe('DELETE_SELECTED', () => {
  it('sets deletedItemIndex and clears selection', () => {
    let state: DrawingEditorState = { ...initialDrawingEditorState, selectedItemIndex: 2 }
    state = dispatch(state, { type: 'DELETE_SELECTED' })
    expect(state.selectedItemIndex).toBeNull()
    expect(state.deletedItemIndex).toBe(2)
  })

  it('does nothing when nothing selected', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'DELETE_SELECTED' })
    expect(state.deletedItemIndex).toBeNull()
  })
})
