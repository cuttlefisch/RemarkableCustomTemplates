import { describe, it, expect } from 'vitest'
import { drawingEditorReducer, initialDrawingEditorState } from '../hooks/useDrawingEditor'
import type { DrawingEditorState, DrawingAction } from '../hooks/useDrawingEditor'
import type { BezierHandles } from '../lib/drawingShapes'

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

// ─── Circle tool ────────────────────────────────────────────────────────────

describe('Circle tool', () => {
  it('first click sets center', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'circle' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 500, y: 500 } })
    expect(state.inProgress).toEqual({ tool: 'circle', vertices: [{ x: 500, y: 500 }] })
  })

  it('second click commits circle', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'circle' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 500, y: 500 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 600, y: 500 } })
    expect(state.committedItem).not.toBeNull()
    expect(state.inProgress).toBeNull()
  })
})

// ─── Bezier tool ────────────────────────────────────────────────────────────

describe('Bezier tool', () => {
  it('accumulates anchor points', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'bezier' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    expect(state.inProgress!.vertices).toHaveLength(2)
  })

  it('closes when clicking near first vertex (3+ points)', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'bezier' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 100 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 2, y: 2 } })
    expect(state.committedItem).not.toBeNull()
    expect(state.inProgress).toBeNull()
  })

  it('FINISH_BEZIER commits open path', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'bezier' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 0, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 0 } })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 200, y: 100 } })
    state = dispatch(state, { type: 'FINISH_BEZIER' })
    expect(state.committedItem).not.toBeNull()
    expect(state.inProgress).toBeNull()
  })
})

// ─── ZOOM / PAN / ZOOM_TO_FIT ──────────────────────────────────────────────

describe('Zoom and pan', () => {
  it('ZOOM updates zoom and pan', () => {
    const state = dispatch(initialDrawingEditorState, {
      type: 'ZOOM',
      zoom: 2.0,
      pan: { x: 100, y: 50 },
    })
    expect(state.zoom).toBe(2.0)
    expect(state.panOffset).toEqual({ x: 100, y: 50 })
  })

  it('PAN shifts panOffset', () => {
    const state = dispatch(initialDrawingEditorState, {
      type: 'PAN',
      dx: 50,
      dy: 30,
    })
    expect(state.panOffset.x).toBeCloseTo(50)
    expect(state.panOffset.y).toBeCloseTo(30)
  })

  it('ZOOM_TO_FIT resets zoom and pan', () => {
    let state: DrawingEditorState = { ...initialDrawingEditorState, zoom: 3.0, panOffset: { x: 200, y: 100 } }
    state = dispatch(state, { type: 'ZOOM_TO_FIT' })
    expect(state.zoom).toBe(1.0)
    expect(state.panOffset).toEqual({ x: 0, y: 0 })
  })
})

// ─── MOVE_ITEM ──────────────────────────────────────────────────────────────

describe('MOVE_ITEM', () => {
  it('sets moveItemIntent', () => {
    const state = dispatch(initialDrawingEditorState, {
      type: 'MOVE_ITEM',
      index: 2,
      direction: 'up',
    })
    expect(state.moveItemIntent).toEqual({ index: 2, direction: 'up' })
  })

  it('CLEAR_MOVE_INTENT clears it', () => {
    let state = dispatch(initialDrawingEditorState, {
      type: 'MOVE_ITEM',
      index: 2,
      direction: 'up',
    })
    state = dispatch(state, { type: 'CLEAR_MOVE_INTENT' })
    expect(state.moveItemIntent).toBeNull()
  })
})

// ─── ROTATE_SELECTED ────────────────────────────────────────────────────────

describe('ROTATE_SELECTED', () => {
  it('sets rotateIntent when item is selected', () => {
    let state: DrawingEditorState = { ...initialDrawingEditorState, selectedItemIndex: 1 }
    state = dispatch(state, { type: 'ROTATE_SELECTED', angle: 45 })
    expect(state.rotateIntent).toEqual({ index: 1, angle: 45 })
  })

  it('does nothing when no item is selected', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'ROTATE_SELECTED', angle: 90 })
    expect(state.rotateIntent).toBeNull()
  })
})

// ─── SET_POINT_SHAPE ──────────────────────────────────────────────────────

describe('SET_POINT_SHAPE', () => {
  it('defaults to dot', () => {
    expect(initialDrawingEditorState.pointShape).toBe('dot')
  })

  it('changes point shape', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_POINT_SHAPE', shape: 'cross' })
    expect(state.pointShape).toBe('cross')
  })

  it('point tool uses dot shape by default (circle-based)', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'point' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.committedItem).not.toBeNull()
    // Dot produces M + 4×C + Z (circle), not M-L-M-L (cross)
    const commands = state.committedItem!.data.filter(t => typeof t === 'string' && ['M', 'C', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'C', 'C', 'C', 'C', 'Z'])
  })

  it('point tool uses cross shape when set', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'point' })
    state = dispatch(state, { type: 'SET_POINT_SHAPE', shape: 'cross' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.committedItem).not.toBeNull()
    // Cross produces M-L-M-L
    const commands = state.committedItem!.data.filter(t => typeof t === 'string' && ['M', 'L'].includes(t as string))
    expect(commands).toEqual(['M', 'L', 'M', 'L'])
  })

  it('point tool uses diamond shape when set', () => {
    let state = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'point' })
    state = dispatch(state, { type: 'SET_POINT_SHAPE', shape: 'diamond' })
    state = dispatch(state, { type: 'CANVAS_CLICK', point: { x: 100, y: 200 } })
    expect(state.committedItem).not.toBeNull()
    // Diamond produces M + 3×L + Z
    const commands = state.committedItem!.data.filter(t => typeof t === 'string' && ['M', 'L', 'Z'].includes(t as string))
    expect(commands).toEqual(['M', 'L', 'L', 'L', 'Z'])
  })
})

// ─── SET_BEZIER_ALGORITHM ────────────────────────────────────────────────────

describe('SET_BEZIER_ALGORITHM', () => {
  it('defaults to catmull-rom', () => {
    expect(initialDrawingEditorState.bezierAlgorithm).toBe('catmull-rom')
  })

  it('changes bezier algorithm', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'SET_BEZIER_ALGORITHM', algorithm: 'hobby' })
    expect(state.bezierAlgorithm).toBe('hobby')
  })

  it('bezier finish with hobby produces different PathData than catmull-rom', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ]

    // Catmull-Rom
    let crState = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'bezier' })
    for (const p of points) crState = dispatch(crState, { type: 'CANVAS_CLICK', point: p })
    crState = dispatch(crState, { type: 'FINISH_BEZIER' })
    const crData = crState.committedItem!.data

    // Hobby
    let hState = dispatch(initialDrawingEditorState, { type: 'SET_TOOL', tool: 'bezier' })
    hState = dispatch(hState, { type: 'SET_BEZIER_ALGORITHM', algorithm: 'hobby' })
    for (const p of points) hState = dispatch(hState, { type: 'CANVAS_CLICK', point: p })
    hState = dispatch(hState, { type: 'FINISH_BEZIER' })
    const hData = hState.committedItem!.data

    // Both produce valid bezier data but with different control points
    expect(crData).not.toEqual(hData)
    // Both should start with M and contain C commands
    expect(crData[0]).toBe('M')
    expect(hData[0]).toBe('M')
    expect(crData.includes('C')).toBe(true)
    expect(hData.includes('C')).toBe(true)
  })
})

// ─── Handle drag state ──────────────────────────────────────────────────────

describe('Handle drag', () => {
  const sampleHandles: BezierHandles = {
    knots: [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ],
    controlPoints: [
      [{ x: 30, y: 10 }, { x: 70, y: 40 }],
      [{ x: 130, y: 60 }, { x: 170, y: 10 }],
    ],
    closed: false,
  }

  it('START_HANDLE_DRAG sets draggingHandle', () => {
    const state = dispatch(initialDrawingEditorState, {
      type: 'START_HANDLE_DRAG',
      itemIndex: 2,
      handleType: 'knot',
      handleIndex: 1,
      handles: sampleHandles,
      startPos: { x: 100, y: 50 },
    })
    expect(state.draggingHandle).not.toBeNull()
    expect(state.draggingHandle!.itemIndex).toBe(2)
    expect(state.draggingHandle!.handleType).toBe('knot')
    expect(state.draggingHandle!.handleIndex).toBe(1)
    expect(state.draggingHandle!.currentPos).toEqual({ x: 100, y: 50 })
  })

  it('UPDATE_HANDLE_DRAG updates currentPos only', () => {
    let state = dispatch(initialDrawingEditorState, {
      type: 'START_HANDLE_DRAG',
      itemIndex: 2,
      handleType: 'knot',
      handleIndex: 1,
      handles: sampleHandles,
      startPos: { x: 100, y: 50 },
    })
    state = dispatch(state, { type: 'UPDATE_HANDLE_DRAG', point: { x: 150, y: 80 } })
    expect(state.draggingHandle!.currentPos).toEqual({ x: 150, y: 80 })
    // Other fields unchanged
    expect(state.draggingHandle!.handleType).toBe('knot')
    expect(state.draggingHandle!.handleIndex).toBe(1)
  })

  it('END_HANDLE_DRAG produces pathEditIntent with modified PathData', () => {
    let state = dispatch(initialDrawingEditorState, {
      type: 'START_HANDLE_DRAG',
      itemIndex: 2,
      handleType: 'knot',
      handleIndex: 1,
      handles: sampleHandles,
      startPos: { x: 100, y: 50 },
    })
    state = dispatch(state, { type: 'UPDATE_HANDLE_DRAG', point: { x: 150, y: 80 } })
    state = dispatch(state, { type: 'END_HANDLE_DRAG' })
    expect(state.draggingHandle).toBeNull()
    expect(state.pathEditIntent).not.toBeNull()
    expect(state.pathEditIntent!.itemIndex).toBe(2)
    // The new data should contain 150 and 80 (the moved knot)
    expect(state.pathEditIntent!.newData).toContain(150)
    expect(state.pathEditIntent!.newData).toContain(80)
  })

  it('END_HANDLE_DRAG is no-op when not dragging', () => {
    const state = dispatch(initialDrawingEditorState, { type: 'END_HANDLE_DRAG' })
    expect(state.draggingHandle).toBeNull()
    expect(state.pathEditIntent).toBeNull()
  })

  it('dragging cp1 modifies only that control point', () => {
    let state = dispatch(initialDrawingEditorState, {
      type: 'START_HANDLE_DRAG',
      itemIndex: 0,
      handleType: 'cp1',
      handleIndex: 0,
      handles: sampleHandles,
      startPos: { x: 30, y: 10 },
    })
    state = dispatch(state, { type: 'UPDATE_HANDLE_DRAG', point: { x: 50, y: 25 } })
    state = dispatch(state, { type: 'END_HANDLE_DRAG' })
    const data = state.pathEditIntent!.newData
    // Original knots should be preserved (0,0 and 100,50 and 200,0)
    expect(data[1]).toBe(0) // first knot x
    expect(data[2]).toBe(0) // first knot y
    // cp1 of segment 0 should be updated to (50, 25)
    expect(data[4]).toBe(50)  // cp1 x
    expect(data[5]).toBe(25)  // cp1 y
  })

  it('CLEAR_PATH_EDIT_INTENT clears intent', () => {
    let state = dispatch(initialDrawingEditorState, {
      type: 'START_HANDLE_DRAG',
      itemIndex: 0,
      handleType: 'knot',
      handleIndex: 0,
      handles: sampleHandles,
      startPos: { x: 0, y: 0 },
    })
    state = dispatch(state, { type: 'END_HANDLE_DRAG' })
    expect(state.pathEditIntent).not.toBeNull()
    state = dispatch(state, { type: 'CLEAR_PATH_EDIT_INTENT' })
    expect(state.pathEditIntent).toBeNull()
  })
})
