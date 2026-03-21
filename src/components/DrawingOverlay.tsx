/**
 * DrawingOverlay — interactive SVG group layer for the drawing editor.
 *
 * Rendered as a <g> child inside TemplateCanvas's <svg>, so coordinate
 * systems align automatically (single CTM).
 */

import { useRef, useCallback } from 'react'
import type { ReactElement } from 'react'
import type { DrawingEditorState, DrawingAction } from '../hooks/useDrawingEditor'
import type { PathItem } from '../types/template'
import type { ResolvedConstants } from '../lib/expression'
import { screenToTemplate } from '../lib/drawingCoords'
import { distanceBetween } from '../lib/drawingCoords'
import { resolvePathDataNumeric, computePathBounds as computePathBoundsFromShapes, extractBezierHandles } from '../lib/drawingShapes'
import type { BezierHandles, Point } from '../lib/drawingShapes'

const SNAP_THRESHOLD = 15

// Bezier handle sizing (template coordinate space, e.g. 1404×1872)
const HIT_RADIUS = 20          // invisible hit target — easy to click
const VISUAL_KNOT_RADIUS = 5   // visible knot dot
const VISUAL_CP_RADIUS = 4     // visible control point dot

export interface IndexedPathItem {
  item: PathItem
  originalIndex: number
}

interface DrawingOverlayProps {
  state: DrawingEditorState
  dispatch: React.Dispatch<DrawingAction>
  templateWidth: number
  templateHeight: number
  items: IndexedPathItem[]
  resolvedConstants?: ResolvedConstants
}

export function DrawingOverlay({
  state,
  dispatch,
  templateWidth,
  templateHeight,
  items,
  resolvedConstants,
}: DrawingOverlayProps): ReactElement {
  const gRef = useRef<SVGGElement>(null)

  const getSvg = useCallback(() => gRef.current?.ownerSVGElement ?? null, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      const svg = getSvg()
      if (!svg) return

      const point = screenToTemplate(e.nativeEvent, svg)

      if (state.activeTool === 'select') {
        const target = e.target as Element

        // Check for rotation handle
        if (target.getAttribute('data-rotation-handle') === 'true' && state.selectedItemIndex !== null) {
          const found = items.find(({ originalIndex }) => originalIndex === state.selectedItemIndex)
          if (found) {
            let bounds = computePathBounds(found.item.data)
            if (!bounds && resolvedConstants) {
              const resolved = resolvePathDataNumeric(found.item.data, resolvedConstants)
              if (resolved) bounds = computePathBoundsFromShapes(resolved)
            }
            if (bounds) {
              const center = {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2,
              }
              const startAngle = Math.atan2(point.y - center.y, point.x - center.x)
              dispatch({
                type: 'START_ROTATION',
                itemIndex: state.selectedItemIndex,
                center,
                startAngle,
              })
              return
            }
          }
        }

        // Check for bezier handle drag
        const handleType = target.getAttribute('data-handle-type') as 'knot' | 'cp1' | 'cp2' | null
        const handleIndex = target.getAttribute('data-handle-index')
        if (handleType && handleIndex !== null && state.selectedItemIndex !== null) {
          const found = items.find(({ originalIndex }) => originalIndex === state.selectedItemIndex)
          if (found) {
            let handles = extractBezierHandles(found.item.data)
            if (!handles && resolvedConstants) {
              const resolved = resolvePathDataNumeric(found.item.data, resolvedConstants)
              if (resolved) handles = extractBezierHandles(resolved)
            }
            if (handles) {
              dispatch({
                type: 'START_HANDLE_DRAG',
                itemIndex: state.selectedItemIndex,
                handleType,
                handleIndex: parseInt(handleIndex),
                handles,
                startPos: point,
              })
              return
            }
          }
        }

        const itemIndex = target.getAttribute('data-item-index')
        if (itemIndex !== null) {
          const idx = parseInt(itemIndex)
          if (idx === state.selectedItemIndex) {
            // Already selected — start drag-to-move
            dispatch({ type: 'START_ITEM_DRAG', itemIndex: idx, startPos: point })
          } else {
            dispatch({ type: 'SELECT_ITEM', index: idx })
          }
        } else {
          dispatch({ type: 'SELECT_ITEM', index: null })
        }
        return
      }

      dispatch({ type: 'CANVAS_CLICK', point })
    },
    [state.activeTool, state.selectedItemIndex, dispatch, getSvg, items, resolvedConstants],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      const svg = getSvg()
      if (!svg) return

      const point = screenToTemplate(e.nativeEvent, svg)

      if (state.rotatingItem) {
        const angle = Math.atan2(
          point.y - state.rotatingItem.center.y,
          point.x - state.rotatingItem.center.x,
        )
        dispatch({ type: 'UPDATE_ROTATION', angle })
        return
      }

      if (state.draggingItem) {
        dispatch({ type: 'UPDATE_ITEM_DRAG', point })
        return
      }

      if (state.draggingHandle) {
        dispatch({ type: 'UPDATE_HANDLE_DRAG', point })
        return
      }

      dispatch({ type: 'CANVAS_MOUSE_MOVE', point })
    },
    [dispatch, getSvg, state.draggingHandle, state.draggingItem, state.rotatingItem],
  )

  const handleMouseUp = useCallback(() => {
    if (state.rotatingItem) {
      dispatch({ type: 'END_ROTATION' })
      return
    }
    if (state.draggingItem) {
      dispatch({ type: 'END_ITEM_DRAG' })
      return
    }
    if (state.draggingHandle) {
      dispatch({ type: 'END_HANDLE_DRAG' })
      return
    }
  }, [state.draggingHandle, state.draggingItem, state.rotatingItem, dispatch])

  // Keydown handling is centralized in TemplatesPage

  const cursor = state.draggingItem ? 'move'
    : state.rotatingItem ? 'grabbing'
    : state.activeTool === 'select' ? 'default'
    : 'crosshair'

  return (
    <g
      ref={gRef}
      data-drawing="true"
      data-tool={state.activeTool}
      style={{ cursor }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Transparent hit area covering the full template */}
      <rect
        x={0} y={0}
        width={templateWidth} height={templateHeight}
        fill="transparent"
        pointerEvents="all"
      />

      {/* Hit targets for selection */}
      {state.activeTool === 'select' &&
        items.map(({ item, originalIndex }) => (
          <HitTarget
            key={originalIndex}
            item={item}
            index={originalIndex}
            isSelected={originalIndex === state.selectedItemIndex}
            isExpression={hasExpressionCoords(item.data)}
            resolvedConstants={resolvedConstants}
          />
        ))}

      {/* Drag ghost preview */}
      {state.draggingItem && (() => {
        const found = items.find(({ originalIndex }) => originalIndex === state.draggingItem!.itemIndex)
        if (!found) return null
        let d = buildSimpleD(found.item)
        if (!d && resolvedConstants) {
          const resolved = resolvePathDataNumeric(found.item.data, resolvedConstants)
          if (resolved) d = buildSimpleDFromData(resolved)
        }
        if (!d) return null
        const { currentOffset } = state.draggingItem
        return (
          <path
            d={d}
            transform={`translate(${currentOffset.x}, ${currentOffset.y})`}
            fill="none"
            stroke="var(--color-editor-apply-bg, #0969da)"
            strokeWidth={2}
            opacity={0.5}
            pointerEvents="none"
          />
        )
      })()}

      {/* Selection indicator / Bezier handle overlay */}
      {state.selectedItemIndex !== null && (() => {
        const found = items.find(({ originalIndex }) => originalIndex === state.selectedItemIndex)
        if (!found) return null
        // Try bezier handle overlay first
        let handles = extractBezierHandles(found.item.data)
        if (!handles && resolvedConstants) {
          const resolved = resolvePathDataNumeric(found.item.data, resolvedConstants)
          if (resolved) handles = extractBezierHandles(resolved)
        }
        if (handles) {
          return <BezierHandleOverlay handles={handles} draggingHandle={state.draggingHandle} />
        }
        return <SelectionIndicator item={found.item} resolvedConstants={resolvedConstants} rotatingItem={state.rotatingItem} />
      })()}

      {/* In-progress shape feedback */}
      {state.inProgress && state.cursorPos && (
        <InProgressFeedback inProgress={state.inProgress} cursorPos={state.cursorPos} />
      )}
    </g>
  )
}

// ─── Hit targets ─────────────────────────────────────────────────────────────

function HitTarget({ item, index, isSelected, isExpression, resolvedConstants }: {
  item: PathItem; index: number; isSelected: boolean; isExpression: boolean; resolvedConstants?: ResolvedConstants
}) {
  let d = buildSimpleD(item)
  if (!d && resolvedConstants) {
    const resolved = resolvePathDataNumeric(item.data, resolvedConstants)
    if (resolved) d = buildSimpleDFromData(resolved)
  }
  if (!d) return null

  const cursor = isSelected
    ? (isExpression ? 'not-allowed' : 'move')
    : 'pointer'

  return (
    <path
      d={d}
      data-item-index={index}
      fill="transparent"
      stroke="transparent"
      strokeWidth={20}
      style={{ cursor }}
    />
  )
}

/** Check if a path item has expression-based (non-numeric) coordinates */
function hasExpressionCoords(data: PathItem['data']): boolean {
  for (const token of data) {
    if (typeof token === 'string' && !['M', 'L', 'C', 'Z'].includes(token)) {
      return true
    }
  }
  return false
}

function buildSimpleD(item: PathItem): string | null {
  return buildSimpleDFromData(item.data)
}

function buildSimpleDFromData(data: PathItem['data']): string | null {
  const parts: string[] = []
  for (const token of data) {
    if (typeof token === 'number') {
      parts.push(String(token))
    } else if (typeof token === 'string' && ['M', 'L', 'C', 'Z'].includes(token)) {
      parts.push(token)
    } else {
      return null
    }
  }
  return parts.join(' ')
}

// ─── Selection indicator ─────────────────────────────────────────────────────

function SelectionIndicator({ item, resolvedConstants, rotatingItem }: {
  item: PathItem
  resolvedConstants?: ResolvedConstants
  rotatingItem: DrawingEditorState['rotatingItem']
}) {
  let bounds = computePathBounds(item.data)
  if (!bounds && resolvedConstants) {
    const resolved = resolvePathDataNumeric(item.data, resolvedConstants)
    if (resolved) bounds = computePathBoundsFromShapes(resolved)
  }
  if (!bounds) {
    // Fallback: dashed path outline
    let d = buildSimpleD(item)
    if (!d && resolvedConstants) {
      const resolved = resolvePathDataNumeric(item.data, resolvedConstants)
      if (resolved) d = buildSimpleDFromData(resolved)
    }
    if (!d) return null
    return (
      <path
        className="selection-handle"
        d={d}
        fill="none"
        stroke="var(--color-editor-apply-bg, #0969da)"
        strokeWidth={3}
        strokeDasharray="8 4"
        pointerEvents="none"
      />
    )
  }

  const pad = 6
  const { minX, minY, maxX, maxY } = bounds
  const handleSize = 6
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const stemLength = 30
  const stemTopY = minY - pad - stemLength

  // Compute rotation preview angle
  const rotAngleDeg = rotatingItem
    ? (rotatingItem.currentAngle - rotatingItem.startAngle) * 180 / Math.PI
    : 0

  const rotTransform = rotatingItem
    ? `rotate(${rotAngleDeg}, ${cx}, ${cy})`
    : undefined

  return (
    <g className="selection-handle" transform={rotTransform}>
      {/* Bounding box */}
      <g pointerEvents="none">
        <rect
          x={minX - pad} y={minY - pad}
          width={maxX - minX + pad * 2} height={maxY - minY + pad * 2}
          fill="none"
          stroke="var(--color-editor-apply-bg, #0969da)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
        {/* 8 handles: corners + midpoints */}
        {[
          [minX - pad, minY - pad],
          [cx, minY - pad],
          [maxX + pad, minY - pad],
          [maxX + pad, (minY + maxY) / 2],
          [maxX + pad, maxY + pad],
          [cx, maxY + pad],
          [minX - pad, maxY + pad],
          [minX - pad, (minY + maxY) / 2],
        ].map(([hx, hy], i) => (
          <rect
            key={i}
            x={hx - handleSize / 2} y={hy - handleSize / 2}
            width={handleSize} height={handleSize}
            fill="white"
            stroke="var(--color-editor-apply-bg, #0969da)"
            strokeWidth={1.5}
          />
        ))}
      </g>

      {/* Rotation handle */}
      {!hasExpressionCoords(item.data) && (
        <>
          <line
            className="rotation-handle-stem"
            x1={cx} y1={minY - pad}
            x2={cx} y2={stemTopY}
            stroke="var(--color-editor-apply-bg, #0969da)"
            strokeWidth={1.5}
            pointerEvents="none"
          />
          <circle
            className="rotation-handle-knob"
            cx={cx} cy={stemTopY}
            r={6}
            fill="var(--color-editor-apply-bg, #0969da)"
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            pointerEvents="all"
            data-rotation-handle="true"
          />
          {/* Invisible enlarged hit target for rotation handle */}
          <circle
            cx={cx} cy={stemTopY}
            r={16}
            fill="transparent"
            pointerEvents="all"
            style={{ cursor: 'grab' }}
            data-rotation-handle="true"
          />
        </>
      )}

      {/* Angle label during rotation */}
      {rotatingItem && Math.abs(rotAngleDeg) > 0.5 && (
        <text
          className="rotation-angle-label"
          x={cx + 20} y={stemTopY}
          fill="var(--color-editor-apply-bg, #0969da)"
          fontSize={14}
          fontWeight={600}
          pointerEvents="none"
        >
          {rotAngleDeg.toFixed(1)}°
        </text>
      )}
    </g>
  )
}

/** Compute bounding box from numeric-only path data */
function computePathBounds(data: PathItem['data']): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let hasPoints = false

  for (let i = 0; i < data.length; i++) {
    const token = data[i]
    if (typeof token === 'string' && ['M', 'L'].includes(token)) {
      const x = data[i + 1]
      const y = data[i + 2]
      if (typeof x !== 'number' || typeof y !== 'number') return null
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      hasPoints = true
      i += 2
    } else if (token === 'C') {
      // Cubic bezier: 3 pairs of coordinates
      for (let j = 0; j < 3; j++) {
        const x = data[i + 1 + j * 2]
        const y = data[i + 2 + j * 2]
        if (typeof x !== 'number' || typeof y !== 'number') return null
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        hasPoints = true
      }
      i += 6
    } else if (token === 'Z') {
      // no-op
    } else if (typeof token === 'string') {
      return null // expression string
    }
  }

  return hasPoints ? { minX, minY, maxX, maxY } : null
}

// ─── Bezier handle overlay ───────────────────────────────────────────────────

function BezierHandleOverlay({
  handles,
  draggingHandle,
}: {
  handles: BezierHandles
  draggingHandle: DrawingEditorState['draggingHandle']
}) {
  const { knots, controlPoints, closed } = handles
  const segCount = controlPoints.length

  // Apply live drag override
  function getKnot(i: number): Point {
    if (draggingHandle?.handleType === 'knot' && draggingHandle.handleIndex === i) {
      return draggingHandle.currentPos
    }
    return knots[i]
  }

  function getCp(segIdx: number, cpIdx: 0 | 1): Point {
    const handleType = cpIdx === 0 ? 'cp1' : 'cp2'
    if (draggingHandle?.handleType === handleType && draggingHandle.handleIndex === segIdx) {
      return draggingHandle.currentPos
    }
    return controlPoints[segIdx][cpIdx]
  }

  return (
    <g className="bezier-handle-overlay" pointerEvents="none">
      {/* Tangent lines */}
      {Array.from({ length: segCount }, (_, i) => {
        const cp1 = getCp(i, 0)
        const cp2 = getCp(i, 1)
        const startKnot = getKnot(i)
        const endKnot = getKnot(closed && i === segCount - 1 ? 0 : i + 1)
        return (
          <g key={`tangent-${i}`}>
            <line
              className="bezier-tangent-line"
              x1={startKnot.x} y1={startKnot.y}
              x2={cp1.x} y2={cp1.y}
              stroke="var(--color-editor-apply-bg, #0969da)"
              strokeWidth={1}
              opacity={0.6}
            />
            <line
              className="bezier-tangent-line"
              x1={endKnot.x} y1={endKnot.y}
              x2={cp2.x} y2={cp2.y}
              stroke="var(--color-editor-apply-bg, #0969da)"
              strokeWidth={1}
              opacity={0.6}
            />
          </g>
        )
      })}

      {/* Control points (hollow circles with enlarged hit targets) */}
      {Array.from({ length: segCount }, (_, i) => {
        const cp1 = getCp(i, 0)
        const cp2 = getCp(i, 1)
        return (
          <g key={`cps-${i}`}>
            {/* Hit targets (invisible, larger radius for easy clicking) */}
            <circle
              cx={cp1.x} cy={cp1.y} r={HIT_RADIUS}
              fill="transparent"
              style={{ cursor: 'move' }}
              pointerEvents="all"
              data-handle-type="cp1"
              data-handle-index={i}
            />
            <circle
              cx={cp2.x} cy={cp2.y} r={HIT_RADIUS}
              fill="transparent"
              style={{ cursor: 'move' }}
              pointerEvents="all"
              data-handle-type="cp2"
              data-handle-index={i}
            />
            {/* Visual circles (small, no pointer events) */}
            <circle
              cx={cp1.x} cy={cp1.y} r={VISUAL_CP_RADIUS}
              fill="white"
              stroke="var(--color-editor-apply-bg, #0969da)"
              strokeWidth={1.5}
              pointerEvents="none"
            />
            <circle
              cx={cp2.x} cy={cp2.y} r={VISUAL_CP_RADIUS}
              fill="white"
              stroke="var(--color-editor-apply-bg, #0969da)"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          </g>
        )
      })}

      {/* Knots (filled circles with enlarged hit targets) */}
      {knots.map((_, i) => {
        const k = getKnot(i)
        return (
          <g key={`knot-${i}`}>
            {/* Hit target */}
            <circle
              cx={k.x} cy={k.y} r={HIT_RADIUS}
              fill="transparent"
              style={{ cursor: 'move' }}
              pointerEvents="all"
              data-handle-type="knot"
              data-handle-index={i}
            />
            {/* Visual circle */}
            <circle
              cx={k.x} cy={k.y} r={VISUAL_KNOT_RADIUS}
              fill="var(--color-editor-apply-bg, #0969da)"
              stroke="white"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          </g>
        )
      })}
    </g>
  )
}

// ─── In-progress feedback ────────────────────────────────────────────────────

function InProgressFeedback({
  inProgress,
  cursorPos,
}: {
  inProgress: { tool: string; vertices: { x: number; y: number }[] }
  cursorPos: { x: number; y: number }
}) {
  const { tool, vertices } = inProgress

  if (tool === 'line' && vertices.length === 1) {
    const start = vertices[0]
    return (
      <line
        className="in-progress-edge"
        x1={start.x}
        y1={start.y}
        x2={cursorPos.x}
        y2={cursorPos.y}
        stroke="var(--color-editor-apply-bg, #0969da)"
        strokeWidth={2}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
    )
  }

  if (tool === 'polygon' || tool === 'bezier') {
    const showCloseIndicator =
      vertices.length >= 3 &&
      distanceBetween(cursorPos, vertices[0]) <= SNAP_THRESHOLD

    return (
      <g pointerEvents="none">
        {/* Existing edges */}
        {vertices.map((v, i) => {
          if (i === 0) return null
          const prev = vertices[i - 1]
          return (
            <line
              key={`edge-${i}`}
              x1={prev.x}
              y1={prev.y}
              x2={v.x}
              y2={v.y}
              stroke="var(--color-editor-apply-bg, #0969da)"
              strokeWidth={2}
              pointerEvents="none"
            />
          )
        })}
        {/* Dashed edge to cursor */}
        {vertices.length > 0 && (
          <line
            className="in-progress-edge"
            x1={vertices[vertices.length - 1].x}
            y1={vertices[vertices.length - 1].y}
            x2={cursorPos.x}
            y2={cursorPos.y}
            stroke="var(--color-editor-apply-bg, #0969da)"
            strokeWidth={2}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
        )}
        {/* Vertex dots */}
        {vertices.map((v, i) => (
          <circle
            key={`vert-${i}`}
            cx={v.x}
            cy={v.y}
            r={4}
            fill="var(--color-editor-apply-bg, #0969da)"
            pointerEvents="none"
          />
        ))}
        {/* Close indicator */}
        {showCloseIndicator && (
          <circle
            className="close-indicator"
            cx={vertices[0].x}
            cy={vertices[0].y}
            r={10}
            fill="none"
            stroke="var(--color-editor-apply-bg, #0969da)"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
      </g>
    )
  }

  if ((tool === 'regularPolygon' || tool === 'circle') && vertices.length === 1) {
    const center = vertices[0]
    const radius = distanceBetween(center, cursorPos)

    return (
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="var(--color-editor-apply-bg, #0969da)"
        strokeWidth={2}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
    )
  }

  return null
}
