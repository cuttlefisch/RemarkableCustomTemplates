/**
 * DrawingToolbar — tool selection, property controls, zoom, layering,
 * undo/redo, and scaling mode for the drawing editor.
 *
 * Uses progressive disclosure: groups are hidden into an overflow menu
 * in reverse priority order when the toolbar is too narrow.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { DrawingEditorState, DrawingAction, DrawingTool, PointShape, BezierAlgorithm } from '../hooks/useDrawingEditor'
import { DEVICES, deviceBuiltins, type DeviceId } from '../lib/renderer'
import { useToolbarOverflow, type ToolbarGroup } from '../hooks/useToolbarOverflow'
import {
  SelectIcon, PointIcon, LineIcon, PolygonIcon, RegularPolygonIcon,
  CircleIcon, BezierIcon, UndoIcon, RedoIcon, DeleteIcon,
  SendBackIcon, SendBackwardIcon, BringForwardIcon, BringFrontIcon,
  ZoomInIcon, ZoomOutIcon, ZoomFitIcon, MoreIcon,
  FlipHorizontalIcon, FlipVerticalIcon, RotateCWIcon, RotateCCWIcon,
} from './DrawingIcons'

interface DrawingToolbarProps {
  /** Current drawing editor state. */
  state: DrawingEditorState
  dispatch: React.Dispatch<DrawingAction>
  /** Active device — determines available scaling modes and dimension labels. */
  deviceId: DeviceId
  orientation: 'portrait' | 'landscape'
  /** Current template background color (hex). */
  backgroundColor: string
  onBackgroundColorChange: (color: string) => void
  /** Current template foreground color (hex). */
  foregroundColor: string
  onForegroundColorChange: (color: string) => void
  /** Callback to reorder items in the z-stack. */
  onMove: (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => void
  /** Callback to rotate the selected item by a fixed angle. */
  onRotate: (index: number, angleDeg: number) => void
  /** Callback to flip the selected item along an axis. */
  onFlip: (index: number, axis: 'horizontal' | 'vertical') => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

const STROKE_WIDTHS = [1, 2, 3, 5, 8]

const TOOLS: { tool: DrawingTool; icon: React.ComponentType; title: string; key: string }[] = [
  { tool: 'select', icon: SelectIcon, title: 'Select', key: 'V' },
  { tool: 'point', icon: PointIcon, title: 'Point', key: 'M' },
  { tool: 'line', icon: LineIcon, title: 'Line', key: 'L' },
  { tool: 'polygon', icon: PolygonIcon, title: 'Polygon', key: 'P' },
  { tool: 'regularPolygon', icon: RegularPolygonIcon, title: 'Regular Polygon', key: 'R' },
  { tool: 'circle', icon: CircleIcon, title: 'Circle', key: 'C' },
  { tool: 'bezier', icon: BezierIcon, title: 'Bezier Curve', key: 'B' },
]

export function DrawingToolbar({
  state,
  dispatch,
  deviceId,
  orientation,
  backgroundColor,
  onBackgroundColorChange,
  foregroundColor,
  onForegroundColorChange,
  onMove,
  onRotate,
  onFlip,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: DrawingToolbarProps) {
  const [statusMessage, setStatusMessage] = useState('')
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowMenuRef = useRef<HTMLDivElement>(null)
  const overflowBtnRef = useRef<HTMLButtonElement>(null)
  const device = DEVICES[deviceId]

  const handleScalingChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'proportional') {
      const builtins = deviceBuiltins(orientation, deviceId)
      dispatch({
        type: 'SET_SCALING_MODE',
        mode: { type: 'proportional', baseWidth: builtins.templateWidth, baseHeight: builtins.templateHeight },
      })
    } else {
      dispatch({ type: 'SET_SCALING_MODE', mode: { type: 'fixed' } })
    }
  }, [dispatch, orientation, deviceId])

  function announceToolChange(toolTitle: string) {
    setStatusMessage(`${toolTitle} tool selected`)
  }

  const zoomPercent = Math.round(state.zoom * 100)
  const hasSelection = state.selectedItemIndex !== null

  // ── Render functions for each group ──

  const renderUndoRedo = useCallback(() => (
    <>
      <button
        className="drawing-tool-btn"
        disabled={!canUndo}
        aria-disabled={!canUndo}
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo (Ctrl+Z)"
      >
        <UndoIcon />
      </button>
      <button
        className="drawing-tool-btn"
        disabled={!canRedo}
        aria-disabled={!canRedo}
        onClick={onRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo (Ctrl+Shift+Z)"
      >
        <RedoIcon />
      </button>
    </>
  ), [canUndo, canRedo, onUndo, onRedo])

  const renderTools = useCallback(() => (
    <div className="drawing-toolbar-group" role="radiogroup" aria-label="Drawing tools">
      {TOOLS.map(({ tool, icon: ToolIcon, title, key }) => (
        <button
          key={tool}
          className={`drawing-tool-btn${state.activeTool === tool ? ' active' : ''}`}
          onClick={() => {
            dispatch({ type: 'SET_TOOL', tool })
            announceToolChange(title)
          }}
          title={`${title} (${key})`}
          role="radio"
          aria-checked={state.activeTool === tool}
          aria-label={`${title} (${key})`}
        >
          <ToolIcon />
        </button>
      ))}
    </div>
  ), [state.activeTool, dispatch])

  const renderShapeOptions = useCallback(() => (
    <>
      {state.activeTool === 'regularPolygon' && (
        <input
          type="number"
          className="drawing-sides-input"
          min={3}
          max={12}
          value={state.regularPolygonSides}
          onChange={e => dispatch({ type: 'SET_REGULAR_SIDES', sides: Math.max(3, Math.min(12, parseInt(e.target.value) || 3)) })}
          title="Number of sides"
          aria-label="Number of sides"
        />
      )}

      {state.activeTool === 'point' && (
        <div className="drawing-point-shapes">
          {([['dot', '●'], ['cross', '✕'], ['diamond', '◇']] as [PointShape, string][]).map(([shape, label]) => (
            <button
              key={shape}
              className={`drawing-tool-btn${state.pointShape === shape ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_POINT_SHAPE', shape })}
              title={`Point shape: ${shape}`}
              aria-label={`Point shape: ${shape}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {state.activeTool === 'bezier' && (
        <div className="drawing-point-shapes">
          {([['catmull-rom', 'C-R'], ['hobby', 'Hobby']] as [BezierAlgorithm, string][]).map(([algo, label]) => (
            <button
              key={algo}
              className={`drawing-tool-btn${state.bezierAlgorithm === algo ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_BEZIER_ALGORITHM', algorithm: algo })}
              title={`Bezier algorithm: ${algo === 'catmull-rom' ? 'Catmull-Rom' : "Hobby's"}`}
              aria-label={`Bezier algorithm: ${algo === 'catmull-rom' ? 'Catmull-Rom' : "Hobby's"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  ), [state.activeTool, state.regularPolygonSides, state.pointShape, state.bezierAlgorithm, dispatch])

  const renderFillStroke = useCallback(() => (
    <>
      <label className="drawing-fill-toggle" title="Fill (F)">
        <input
          type="checkbox"
          checked={state.fillEnabled}
          onChange={e => dispatch({ type: 'SET_FILL_ENABLED', enabled: e.target.checked })}
          aria-label="Toggle fill (F)"
        />
        Fill
      </label>
      {state.fillEnabled && (
        <>
          <label className="drawing-color-label">
            <input
              type="color"
              className={`drawing-color-picker${state.fillUseForeground ? ' dimmed' : ''}`}
              value={state.fillUseForeground ? foregroundColor : state.fillColor}
              onChange={e => dispatch({ type: 'SET_FILL_COLOR', color: e.target.value })}
              disabled={state.fillUseForeground}
              title="Fill color"
              aria-label="Fill color"
            />
          </label>
          <button
            className={`drawing-tool-btn drawing-fg-pin${state.fillUseForeground ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_FILL_USE_FOREGROUND', enabled: !state.fillUseForeground })}
            title="Pin fill to foreground color"
            aria-label="Pin fill to foreground color"
          >
            FG
          </button>
        </>
      )}

      <label className="drawing-color-label">
        <span>Stroke</span>
        <input
          type="color"
          className={`drawing-color-picker${state.strokeUseForeground ? ' dimmed' : ''}`}
          value={state.strokeUseForeground ? foregroundColor : state.strokeColor}
          onChange={e => dispatch({ type: 'SET_STROKE_COLOR', color: e.target.value })}
          disabled={state.strokeUseForeground}
          title="Stroke color"
          aria-label="Stroke color"
        />
      </label>
      <button
        className={`drawing-tool-btn drawing-fg-pin${state.strokeUseForeground ? ' active' : ''}`}
        onClick={() => dispatch({ type: 'SET_STROKE_USE_FOREGROUND', enabled: !state.strokeUseForeground })}
        title="Pin stroke to foreground color"
        aria-label="Pin stroke to foreground color"
      >
        FG
      </button>

      <label className="drawing-color-label">
        <span>Width</span>
        <select
          className="drawing-stroke-width-select"
          value={state.strokeWidth}
          onChange={e => dispatch({ type: 'SET_STROKE_WIDTH', width: Number(e.target.value) })}
          title="Stroke width"
          aria-label="Stroke width"
        >
          {STROKE_WIDTHS.map(w => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>
      </label>

      <label className="drawing-color-label">
        <span>FG</span>
        <input
          type="color"
          className="drawing-color-picker"
          value={foregroundColor}
          onChange={e => onForegroundColorChange(e.target.value)}
          title="Foreground color"
          aria-label="Foreground color"
        />
      </label>

      <label className="drawing-color-label">
        <span>BG</span>
        <input
          type="color"
          className="drawing-color-picker"
          value={backgroundColor}
          onChange={e => onBackgroundColorChange(e.target.value)}
          title="Background color"
          aria-label="Background color"
        />
      </label>
    </>
  ), [state.fillEnabled, state.fillUseForeground, state.fillColor, state.strokeUseForeground, state.strokeColor, state.strokeWidth, foregroundColor, backgroundColor, dispatch, onForegroundColorChange, onBackgroundColorChange])

  const renderLayerTransform = useCallback(() => (
    <>
      {hasSelection && (
        <>
          <button
            className="drawing-layer-btn"
            onClick={() => onMove(state.selectedItemIndex!, 'bottom')}
            title="Send to back (Shift+[)"
            aria-label="Send to back (Shift+[)"
          >
            <SendBackIcon />
          </button>
          <button
            className="drawing-layer-btn"
            onClick={() => onMove(state.selectedItemIndex!, 'down')}
            title="Send backward ([)"
            aria-label="Send backward ([)"
          >
            <SendBackwardIcon />
          </button>
          <button
            className="drawing-layer-btn"
            onClick={() => onMove(state.selectedItemIndex!, 'up')}
            title="Bring forward (])"
            aria-label="Bring forward (])"
          >
            <BringForwardIcon />
          </button>
          <button
            className="drawing-layer-btn"
            onClick={() => onMove(state.selectedItemIndex!, 'top')}
            title="Bring to front (Shift+])"
            aria-label="Bring to front (Shift+])"
          >
            <BringFrontIcon />
          </button>

          <button
            className="drawing-layer-btn"
            onClick={() => onFlip(state.selectedItemIndex!, 'horizontal')}
            title="Flip Horizontal (H)"
            aria-label="Flip Horizontal (H)"
          >
            <FlipHorizontalIcon />
          </button>
          <button
            className="drawing-layer-btn"
            onClick={() => onFlip(state.selectedItemIndex!, 'vertical')}
            title="Flip Vertical (J)"
            aria-label="Flip Vertical (J)"
          >
            <FlipVerticalIcon />
          </button>
          <button
            className="drawing-layer-btn"
            onClick={() => onRotate(state.selectedItemIndex!, 90)}
            title="Rotate 90° CW"
            aria-label="Rotate 90° CW"
          >
            <RotateCWIcon />
          </button>
          <button
            className="drawing-layer-btn"
            onClick={() => onRotate(state.selectedItemIndex!, -90)}
            title="Rotate 90° CCW"
            aria-label="Rotate 90° CCW"
          >
            <RotateCCWIcon />
          </button>
        </>
      )}

      <button
        className="drawing-tool-btn drawing-delete-btn"
        disabled={!hasSelection}
        aria-disabled={!hasSelection}
        onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
        title="Delete selected item (Del)"
        aria-label="Delete selected item (Del)"
      >
        <DeleteIcon />
      </button>
    </>
  ), [hasSelection, state.selectedItemIndex, onMove, onFlip, onRotate, dispatch])

  const renderZoomScale = useCallback(() => (
    <>
      <div className="drawing-zoom-controls">
        <button
          className="drawing-tool-btn"
          onClick={() => {
            const newZoom = Math.max(0.1, state.zoom - 0.25)
            dispatch({ type: 'ZOOM', zoom: newZoom, pan: state.panOffset })
          }}
          title="Zoom out (-)"
          aria-label="Zoom out (-)"
        >
          <ZoomOutIcon />
        </button>
        <span className="drawing-zoom-label">{zoomPercent}%</span>
        <button
          className="drawing-tool-btn"
          onClick={() => {
            const newZoom = Math.min(10, state.zoom + 0.25)
            dispatch({ type: 'ZOOM', zoom: newZoom, pan: state.panOffset })
          }}
          title="Zoom in (+)"
          aria-label="Zoom in (+)"
        >
          <ZoomInIcon />
        </button>
        <button
          className="drawing-tool-btn"
          onClick={() => dispatch({ type: 'ZOOM_TO_FIT' })}
          title="Zoom to fit (0)"
          aria-label="Zoom to fit (0)"
        >
          <ZoomFitIcon />
        </button>
      </div>

      <label className="drawing-color-label">
        <span>Coords</span>
        <select
          className="drawing-scaling-select"
          value={state.scalingMode.type}
          onChange={handleScalingChange}
          title="Coordinate mode"
          aria-label="Coordinate mode"
        >
          <option value="proportional" title="Coordinates scale proportionally across devices">Adaptive</option>
          <option value="fixed" title="Coordinates are pixel-exact for this device only">Fixed ({device.shortName})</option>
        </select>
      </label>
    </>
  ), [state.zoom, state.panOffset, state.scalingMode.type, zoomPercent, device.shortName, dispatch, handleScalingChange])

  // ── Group definitions with priority ──

  const groups: ToolbarGroup[] = useMemo(() => [
    { id: 'undo-redo', priority: 0, render: renderUndoRedo },
    { id: 'tools', priority: 0, render: renderTools },
    { id: 'shape-options', priority: 1, render: renderShapeOptions },
    { id: 'fill-stroke', priority: 1, render: renderFillStroke },
    { id: 'layer-transform', priority: 2, render: renderLayerTransform },
    { id: 'zoom-scale', priority: 3, render: renderZoomScale },
  ], [renderUndoRedo, renderTools, renderShapeOptions, renderFillStroke, renderLayerTransform, renderZoomScale])

  const { containerRef, overflowIds } = useToolbarOverflow(groups)

  const hasOverflow = overflowIds.size > 0
  const overflowGroups = groups.filter(g => overflowIds.has(g.id))

  // Close overflow menu on Escape or click outside
  useEffect(() => {
    if (!overflowOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOverflowOpen(false)
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        overflowMenuRef.current && !overflowMenuRef.current.contains(target) &&
        overflowBtnRef.current && !overflowBtnRef.current.contains(target)
      ) {
        setOverflowOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [overflowOpen])

  return (
    <div className="drawing-toolbar" role="toolbar" aria-label="Drawing tools" ref={containerRef}>
      {/* Visually hidden live region for screen reader announcements */}
      <div className="visually-hidden" aria-live="polite" role="status">
        {statusMessage}
      </div>

      {/* ── All groups (hidden overflow groups stay in DOM for measurement) ── */}
      {groups.map((group, i) => {
        const isOverflow = overflowIds.has(group.id)
        return (
          <React.Fragment key={group.id}>
            {i > 0 && !isOverflow && <div className="drawing-toolbar-separator" />}
            <div
              className="drawing-toolbar-group"
              data-toolbar-group={group.id}
              style={isOverflow ? { display: 'none' } : undefined}
            >
              {group.render()}
            </div>
          </React.Fragment>
        )
      })}

      {/* ── Overflow button + menu ── */}
      {hasOverflow && (
        <>
          <div className="drawing-toolbar-separator" />
          <button
            ref={overflowBtnRef}
            className={`drawing-tool-btn${overflowOpen ? ' active' : ''}`}
            onClick={() => setOverflowOpen(o => !o)}
            title="More tools"
            aria-label="More tools"
            aria-expanded={overflowOpen}
            data-toolbar-overflow
          >
            <MoreIcon />
          </button>

          {overflowOpen && (
            <div className="drawing-toolbar-overflow-menu" ref={overflowMenuRef}>
              {overflowGroups.map((group, i) => (
                <React.Fragment key={group.id}>
                  {i > 0 && <div className="drawing-toolbar-separator drawing-toolbar-separator-h" />}
                  <div className="drawing-toolbar-group">
                    {group.render()}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

