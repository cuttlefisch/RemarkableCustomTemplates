/**
 * Drawing editor state management via useReducer.
 *
 * The reducer is a pure function — fully testable without DOM.
 * The hook wraps it with side-effects (commit callback, clearing committed items).
 */

import { useReducer, useEffect, useRef, useCallback } from 'react'
import type { PathItem, PathData } from '../types/template'
import type { Point, ScalingMode, ShapeProps, BezierHandles } from '../lib/drawingShapes'
import {
  buildPointItem,
  buildDotItem,
  buildDiamondItem,
  buildLineItem,
  buildPolygonItem,
  buildRegularPolygonItem,
  buildCircleItem,
  buildBezierItem,
  buildBezierItemHobby,
  rebuildBezierPathData,
} from '../lib/drawingShapes'
import { distanceBetween } from '../lib/drawingCoords'
import { clampPan } from '../lib/drawingViewport'

// ─── Types ───────────────────────────────────────────────────────────────────

export type DrawingTool = 'select' | 'point' | 'line' | 'polygon' | 'regularPolygon' | 'circle' | 'bezier'
export type PointShape = 'dot' | 'cross' | 'diamond'
export type BezierAlgorithm = 'catmull-rom' | 'hobby'

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
  pointShape: PointShape
  fillEnabled: boolean
  fillColor: string
  strokeColor: string
  strokeWidth: number
  committedItem: PathItem | null
  deletedItemIndex: number | null
  // Zoom/pan
  zoom: number
  panOffset: Point
  // Layering intent (handled by parent)
  moveItemIntent: { index: number; direction: 'up' | 'down' | 'top' | 'bottom' } | null
  // Rotation intent (handled by parent)
  rotateIntent: { index: number; angle: number } | null
  // Bezier algorithm
  bezierAlgorithm: BezierAlgorithm
  // Handle drag state
  draggingHandle: {
    itemIndex: number
    handleType: 'knot' | 'cp1' | 'cp2'
    handleIndex: number
    originalHandles: BezierHandles
    currentPos: Point
  } | null
  // Path edit intent (handled by parent)
  pathEditIntent: { itemIndex: number; newData: PathData } | null
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
  | { type: 'FINISH_BEZIER' }
  // Zoom/pan
  | { type: 'ZOOM'; zoom: number; pan: Point }
  | { type: 'PAN'; dx: number; dy: number }
  | { type: 'ZOOM_TO_FIT' }
  // Layering
  | { type: 'MOVE_ITEM'; index: number; direction: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'CLEAR_MOVE_INTENT' }
  // Rotation
  | { type: 'ROTATE_SELECTED'; angle: number }
  | { type: 'CLEAR_ROTATE_INTENT' }
  // Point shape
  | { type: 'SET_POINT_SHAPE'; shape: PointShape }
  // Bezier algorithm
  | { type: 'SET_BEZIER_ALGORITHM'; algorithm: BezierAlgorithm }
  // Handle drag
  | { type: 'START_HANDLE_DRAG'; itemIndex: number; handleType: 'knot' | 'cp1' | 'cp2'; handleIndex: number; handles: BezierHandles; startPos: Point }
  | { type: 'UPDATE_HANDLE_DRAG'; point: Point }
  | { type: 'END_HANDLE_DRAG' }
  | { type: 'CLEAR_PATH_EDIT_INTENT' }

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
  pointShape: 'dot',
  fillEnabled: false,
  fillColor: '#cccccc',
  strokeColor: '#000000',
  strokeWidth: 2,
  committedItem: null,
  deletedItemIndex: null,
  zoom: 1.0,
  panOffset: { x: 0, y: 0 },
  moveItemIntent: null,
  rotateIntent: null,
  bezierAlgorithm: 'catmull-rom',
  draggingHandle: null,
  pathEditIntent: null,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyHandleEdit(
  handles: BezierHandles,
  handleType: 'knot' | 'cp1' | 'cp2',
  handleIndex: number,
  newPos: Point,
): BezierHandles {
  const newKnots = [...handles.knots]
  const newCPs = handles.controlPoints.map(([cp1, cp2]) => [{ ...cp1 }, { ...cp2 }] as [Point, Point])

  switch (handleType) {
    case 'knot':
      newKnots[handleIndex] = newPos
      break
    case 'cp1':
      newCPs[handleIndex] = [newPos, newCPs[handleIndex][1]]
      break
    case 'cp2':
      newCPs[handleIndex] = [newCPs[handleIndex][0], newPos]
      break
  }

  return { knots: newKnots, controlPoints: newCPs, closed: handles.closed }
}

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

    case 'FINISH_BEZIER':
      return handleFinishBezier(state)

    // Zoom/pan
    case 'ZOOM':
      return { ...state, zoom: action.zoom, panOffset: action.pan }

    case 'PAN': {
      const newPan = clampPan(
        { x: state.panOffset.x + action.dx, y: state.panOffset.y + action.dy },
        state.zoom,
        1404, // These are approximate; parent passes real values via viewBox
        1872,
      )
      return { ...state, panOffset: newPan }
    }

    case 'ZOOM_TO_FIT':
      return { ...state, zoom: 1.0, panOffset: { x: 0, y: 0 } }

    // Layering
    case 'MOVE_ITEM':
      return { ...state, moveItemIntent: { index: action.index, direction: action.direction } }

    case 'CLEAR_MOVE_INTENT':
      return { ...state, moveItemIntent: null }

    // Rotation
    case 'ROTATE_SELECTED':
      if (state.selectedItemIndex === null) return state
      return { ...state, rotateIntent: { index: state.selectedItemIndex, angle: action.angle } }

    case 'CLEAR_ROTATE_INTENT':
      return { ...state, rotateIntent: null }

    // Point shape
    case 'SET_POINT_SHAPE':
      return { ...state, pointShape: action.shape }

    // Bezier algorithm
    case 'SET_BEZIER_ALGORITHM':
      return { ...state, bezierAlgorithm: action.algorithm }

    // Handle drag
    case 'START_HANDLE_DRAG':
      return {
        ...state,
        draggingHandle: {
          itemIndex: action.itemIndex,
          handleType: action.handleType,
          handleIndex: action.handleIndex,
          originalHandles: action.handles,
          currentPos: action.startPos,
        },
      }

    case 'UPDATE_HANDLE_DRAG':
      if (!state.draggingHandle) return state
      return {
        ...state,
        draggingHandle: { ...state.draggingHandle, currentPos: action.point },
      }

    case 'END_HANDLE_DRAG': {
      if (!state.draggingHandle) return state
      const { itemIndex, handleType, handleIndex, originalHandles, currentPos } = state.draggingHandle
      const newHandles = applyHandleEdit(originalHandles, handleType, handleIndex, currentPos)
      return {
        ...state,
        draggingHandle: null,
        pathEditIntent: { itemIndex, newData: rebuildBezierPathData(newHandles) },
      }
    }

    case 'CLEAR_PATH_EDIT_INTENT':
      return { ...state, pathEditIntent: null }

    default:
      return state
  }
}

function handleCanvasClick(state: DrawingEditorState, point: Point): DrawingEditorState {
  const props = getShapeProps(state)
  const { scalingMode } = state

  switch (state.activeTool) {
    case 'point': {
      let item: PathItem
      switch (state.pointShape) {
        case 'cross':
          item = buildPointItem(point, POINT_SIZE, props, scalingMode)
          break
        case 'diamond':
          item = buildDiamondItem(point, POINT_SIZE, props, scalingMode)
          break
        case 'dot':
        default:
          item = buildDotItem(point, POINT_SIZE, props, scalingMode)
          break
      }
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
      if (vertices.length >= 3 && distanceBetween(point, vertices[0]) <= SNAP_THRESHOLD) {
        const item = buildPolygonItem(vertices, true, props, scalingMode)
        return { ...state, committedItem: item, inProgress: null }
      }
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

    case 'circle': {
      if (!state.inProgress) {
        return { ...state, inProgress: { tool: 'circle', vertices: [point] } }
      }
      const center = state.inProgress.vertices[0]
      const radius = distanceBetween(center, point)
      const item = buildCircleItem(center, radius, props, scalingMode)
      return { ...state, committedItem: item, inProgress: null }
    }

    case 'bezier': {
      if (!state.inProgress) {
        return { ...state, inProgress: { tool: 'bezier', vertices: [point] } }
      }
      const vertices = state.inProgress.vertices
      // Close if clicking near first vertex (3+ vertices)
      if (vertices.length >= 3 && distanceBetween(point, vertices[0]) <= SNAP_THRESHOLD) {
        const build = state.bezierAlgorithm === 'hobby' ? buildBezierItemHobby : buildBezierItem
        const item = build(vertices, true, props, scalingMode)
        return { ...state, committedItem: item, inProgress: null }
      }
      if (vertices.length >= 1 && vertices.length < 3 && distanceBetween(point, vertices[0]) <= SNAP_THRESHOLD) {
        return state
      }
      return {
        ...state,
        inProgress: { tool: 'bezier', vertices: [...vertices, point] },
      }
    }

    case 'select':
    default:
      return state
  }
}

function handleFinishBezier(state: DrawingEditorState): DrawingEditorState {
  if (!state.inProgress || state.inProgress.tool !== 'bezier') return state
  const vertices = state.inProgress.vertices
  if (vertices.length < 2) return state
  const props = getShapeProps(state)
  const build = state.bezierAlgorithm === 'hobby' ? buildBezierItemHobby : buildBezierItem
  const item = build(vertices, false, props, state.scalingMode)
  return { ...state, committedItem: item, inProgress: null }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseDrawingEditorOptions {
  onCommit: (item: PathItem, scalingMode: ScalingMode) => void
  onDelete: (index: number) => void
  onPathEdit: (itemIndex: number, newData: PathData) => void
}

export function useDrawingEditor({ onCommit, onDelete, onPathEdit }: UseDrawingEditorOptions) {
  const [state, dispatch] = useReducer(drawingEditorReducer, initialDrawingEditorState)

  // Use refs to always have the latest callbacks without triggering effects
  const onCommitRef = useRef(onCommit)
  const onDeleteRef = useRef(onDelete)
  const onPathEditRef = useRef(onPathEdit)
  useEffect(() => { onCommitRef.current = onCommit }, [onCommit])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])
  useEffect(() => { onPathEditRef.current = onPathEdit }, [onPathEdit])

  // Handle committed items
  useEffect(() => {
    if (state.committedItem) {
      onCommitRef.current(state.committedItem, state.scalingMode)
      dispatch({ type: 'CLEAR_COMMITTED' })
    }
  }, [state.committedItem, state.scalingMode])

  // Handle deleted items
  useEffect(() => {
    if (state.deletedItemIndex !== null) {
      onDeleteRef.current(state.deletedItemIndex)
      dispatch({ type: 'CLEAR_DELETED' })
    }
  }, [state.deletedItemIndex])

  // Handle path edit intents (from handle dragging)
  useEffect(() => {
    if (state.pathEditIntent) {
      onPathEditRef.current(state.pathEditIntent.itemIndex, state.pathEditIntent.newData)
      dispatch({ type: 'CLEAR_PATH_EDIT_INTENT' })
    }
  }, [state.pathEditIntent])

  const setScalingModeForDevice = useCallback((_deviceId: string, baseWidth: number, baseHeight: number) => {
    dispatch({
      type: 'SET_SCALING_MODE',
      mode: { type: 'proportional', baseWidth, baseHeight },
    })
  }, [])

  return { state, dispatch, setScalingModeForDevice }
}
