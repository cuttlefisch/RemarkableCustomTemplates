/**
 * DrawingOverlay — interactive SVG overlay for the drawing editor.
 *
 * Positioned absolutely on top of TemplateCanvas with an identical viewBox,
 * so coordinate systems align automatically.
 */

import { useRef, useCallback, useEffect } from 'react'
import type { ReactElement } from 'react'
import type { DrawingEditorState, DrawingAction } from '../hooks/useDrawingEditor'
import type { PathItem } from '../types/template'
import { screenToTemplate } from '../lib/drawingCoords'
import { distanceBetween } from '../lib/drawingCoords'

const SNAP_THRESHOLD = 15

interface DrawingOverlayProps {
  state: DrawingEditorState
  dispatch: React.Dispatch<DrawingAction>
  templateWidth: number
  templateHeight: number
  items: PathItem[]
}

export function DrawingOverlay({
  state,
  dispatch,
  templateWidth,
  templateHeight,
  items,
}: DrawingOverlayProps): ReactElement {
  const svgRef = useRef<SVGSVGElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return
      const point = screenToTemplate(e.nativeEvent, svgRef.current)

      if (state.activeTool === 'select') {
        // Check if clicked on an item hit target
        const target = e.target as Element
        const itemIndex = target.getAttribute('data-item-index')
        if (itemIndex !== null) {
          dispatch({ type: 'SELECT_ITEM', index: parseInt(itemIndex) })
        } else {
          dispatch({ type: 'SELECT_ITEM', index: null })
        }
        return
      }

      dispatch({ type: 'CANVAS_CLICK', point })
    },
    [state.activeTool, dispatch],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return
      const point = screenToTemplate(e.nativeEvent, svgRef.current)
      dispatch({ type: 'CANVAS_MOUSE_MOVE', point })
    },
    [dispatch],
  )

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL' })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch])

  const cursor = state.activeTool === 'select' ? 'default' : 'crosshair'

  return (
    <svg
      ref={svgRef}
      className="drawing-overlay"
      viewBox={`0 0 ${templateWidth} ${templateHeight}`}
      style={{ cursor }}
      data-tool={state.activeTool}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      {/* Hit targets for selection */}
      {state.activeTool === 'select' &&
        items.map((item, i) => (
          <HitTarget key={i} item={item} index={i} />
        ))}

      {/* Selection indicator */}
      {state.selectedItemIndex !== null && items[state.selectedItemIndex] && (
        <SelectionIndicator item={items[state.selectedItemIndex]} />
      )}

      {/* In-progress shape feedback */}
      {state.inProgress && state.cursorPos && (
        <InProgressFeedback inProgress={state.inProgress} cursorPos={state.cursorPos} />
      )}
    </svg>
  )
}

// ─── Hit targets ─────────────────────────────────────────────────────────────

function HitTarget({ item, index }: { item: PathItem; index: number }) {
  // Build a simple SVG d string from numeric path data only
  const d = buildSimpleD(item)
  if (!d) return null

  return (
    <path
      d={d}
      data-item-index={index}
      fill="transparent"
      stroke="transparent"
      strokeWidth={20}
      style={{ cursor: 'pointer' }}
    />
  )
}

function buildSimpleD(item: PathItem): string | null {
  const parts: string[] = []
  for (const token of item.data) {
    if (typeof token === 'number') {
      parts.push(String(token))
    } else if (typeof token === 'string' && ['M', 'L', 'C', 'Z'].includes(token)) {
      parts.push(token)
    } else {
      // Expression — can't render hit target
      return null
    }
  }
  return parts.join(' ')
}

// ─── Selection indicator ─────────────────────────────────────────────────────

function SelectionIndicator({ item }: { item: PathItem }) {
  const d = buildSimpleD(item)
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

  if (tool === 'polygon') {
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

  if (tool === 'regularPolygon' && vertices.length === 1) {
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
