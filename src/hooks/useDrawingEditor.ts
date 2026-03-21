/**
 * Drawing editor state management via useReducer.
 *
 * The reducer is a pure function — fully testable without DOM.
 * The hook wraps it with side-effects (commit callback, clearing committed items).
 */

import { useReducer, useEffect, useCallback } from 'react'
import type { PathItem } from '../types/template'
import type { Point, ScalingMode, ShapeProps } from '../lib/drawingShapes'
import {
  buildPointItem,
  buildLineItem,
  buildPolygonItem,
  buildRegularPolygonItem,
} from '../lib/drawingShapes'
import { distanceBetween } from '../lib/drawingCoords'

// ─── Types ───────────────────────────────────────────────────────────────────

export type DrawingTool = 'select' | 'point' | 'line' | 'polygon' | 'regularPolygon'

export interface InProgressShape {
  tool: DrawingTool
  vertices: Point[]
}

export interface DrawingEditorState {
  activeTool: DrawingTool
  regularPolygonSides: number
  scalingMode: ScalingMode
  inProgress: InProgressShape | null
  cursorPos: Point | null
  selectedItemIndex: number | null
  fillEnabled: boolean
  fillColor: string
  strokeColor: string
  strokeWidth: number
  committedItem: PathItem | null
  deletedItemIndex: number | null
}

export type DrawingAction =
  | { type: 'SET_TOOL'; tool: DrawingTool }
  | { type: 'SET_REGULAR_SIDES'; sides: number }
  | { type: 'SET_SCALING_MODE'; mode: ScalingMode }
  | { type: 'CANVAS_CLICK'; point: Point }
  | { type: 'CANVAS_MOUSE_MOVE'; point: Point }
  | { type: 'CANCEL' }
  | { type: 'SELECT_ITEM'; index: number | null }
  | { type: 'DELETE_SELECTED' }
  | { type: 'SET_FILL_ENABLED'; enabled: boolean }
  | { type: 'SET_FILL_COLOR'; color: string }
  | { type: 'SET_STROKE_COLOR'; color: string }
  | { type: 'SET_STROKE_WIDTH'; width: number }
  | { type: 'CLEAR_COMMITTED' }
  | { type: 'CLEAR_DELETED' }

// ─── Constants ───────────────────────────────────────────────────────────────

const SNAP_THRESHOLD = 15
const POINT_SIZE = 10

// ─── Initial state ───────────────────────────────────────────────────────────

export const initialDrawingEditorState: DrawingEditorState = {
  activeTool: 'select',
  regularPolygonSides: 6,
  scalingMode: { type: 'proportional', baseWidth: 1404, baseHeight: 1872 },
  inProgress: null,
  cursorPos: null,
  selectedItemIndex: null,
  fillEnabled: false,
  fillColor: '#cccccc',
  strokeColor: '#000000',
  strokeWidth: 2,
  committedItem: null,
  deletedItemIndex: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getShapeProps(state: DrawingEditorState): ShapeProps {
  return {
    fillEnabled: state.fillEnabled,
    fillColor: state.fillColor,
    strokeColor: state.strokeColor,
    strokeWidth: state.strokeWidth,
  }
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function drawingEditorReducer(
  state: DrawingEditorState,
  action: DrawingAction,
): DrawingEditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        inProgress: null,
        selectedItemIndex: action.tool !== 'select' ? null : state.selectedItemIndex,
      }

    case 'SET_REGULAR_SIDES':
      return { ...state, regularPolygonSides: action.sides }

    case 'SET_SCALING_MODE':
      return { ...state, scalingMode: action.mode }

    case 'CANVAS_CLICK':
      return handleCanvasClick(state, action.point)

    case 'CANVAS_MOUSE_MOVE':
      return { ...state, cursorPos: action.point }

    case 'CANCEL':
      return { ...state, inProgress: null }

    case 'SELECT_ITEM':
      return { ...state, selectedItemIndex: action.index }

    case 'DELETE_SELECTED':
      if (state.selectedItemIndex === null) return state
      return {
        ...state,
        deletedItemIndex: state.selectedItemIndex,
        selectedItemIndex: null,
      }

    case 'SET_FILL_ENABLED':
      return { ...state, fillEnabled: action.enabled }

    case 'SET_FILL_COLOR':
      return { ...state, fillColor: action.color }

    case 'SET_STROKE_COLOR':
      return { ...state, strokeColor: action.color }

    case 'SET_STROKE_WIDTH':
      return { ...state, strokeWidth: action.width }

    case 'CLEAR_COMMITTED':
      return { ...state, committedItem: null }

    case 'CLEAR_DELETED':
      return { ...state, deletedItemIndex: null }

    default:
      return state
  }
}

function handleCanvasClick(state: DrawingEditorState, point: Point): DrawingEditorState {
  const props = getShapeProps(state)
  const { scalingMode } = state

  switch (state.activeTool) {
    case 'point': {
      const item = buildPointItem(point, POINT_SIZE, props, scalingMode)
      return { ...state, committedItem: item, inProgress: null }
    }

    case 'line': {
      if (!state.inProgress) {
        return { ...state, inProgress: { tool: 'line', vertices: [point] } }
      }
      const start = state.inProgress.vertices[0]
      const item = buildLineItem(start, point, props, scalingMode)
      return { ...state, committedItem: item, inProgress: null }
    }

    case 'polygon': {
      if (!state.inProgress) {
        return { ...state, inProgress: { tool: 'polygon', vertices: [point] } }
      }
      const vertices = state.inProgress.vertices
      // Check if clicking near first vertex to close (need 3+ vertices)
      if (vertices.length >= 3 && distanceBetween(point, vertices[0]) <= SNAP_THRESHOLD) {
        const item = buildPolygonItem(vertices, true, props, scalingMode)
        return { ...state, committedItem: item, inProgress: null }
      }
      // If near first vertex but not enough vertices, don't add duplicate point
      if (vertices.length >= 1 && vertices.length < 3 && distanceBetween(point, vertices[0]) <= SNAP_THRESHOLD) {
        return state
      }
      return {
        ...state,
        inProgress: { tool: 'polygon', vertices: [...vertices, point] },
      }
    }

    case 'regularPolygon': {
      if (!state.inProgress) {
        return { ...state, inProgress: { tool: 'regularPolygon', vertices: [point] } }
      }
      const center = state.inProgress.vertices[0]
      const radius = distanceBetween(center, point)
      const item = buildRegularPolygonItem(center, radius, state.regularPolygonSides, props, scalingMode)
      return { ...state, committedItem: item, inProgress: null }
    }

    case 'select':
    default:
      return state
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseDrawingEditorOptions {
  onCommit: (item: PathItem, scalingMode: ScalingMode) => void
  onDelete: (index: number) => void
}

export function useDrawingEditor({ onCommit, onDelete }: UseDrawingEditorOptions) {
  const [state, dispatch] = useReducer(drawingEditorReducer, initialDrawingEditorState)

  // Handle committed items
  useEffect(() => {
    if (state.committedItem) {
      onCommit(state.committedItem, state.scalingMode)
      dispatch({ type: 'CLEAR_COMMITTED' })
    }
  }, [state.committedItem, state.scalingMode, onCommit])

  // Handle deleted items
  useEffect(() => {
    if (state.deletedItemIndex !== null) {
      onDelete(state.deletedItemIndex)
      dispatch({ type: 'CLEAR_DELETED' })
    }
  }, [state.deletedItemIndex, onDelete])

  const setScalingModeForDevice = useCallback((_deviceId: string, baseWidth: number, baseHeight: number) => {
    dispatch({
      type: 'SET_SCALING_MODE',
      mode: { type: 'proportional', baseWidth, baseHeight },
    })
  }, [])

  return { state, dispatch, setScalingModeForDevice }
}
