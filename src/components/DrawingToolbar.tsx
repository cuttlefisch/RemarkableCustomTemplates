/**
 * DrawingToolbar — tool selection, property controls, zoom, layering,
 * undo/redo, and scaling mode for the drawing editor.
 */

import { useState } from 'react'
import type { DrawingEditorState, DrawingAction, DrawingTool, PointShape, BezierAlgorithm } from '../hooks/useDrawingEditor'
import { DEVICES, type DeviceId } from '../lib/renderer'
import {
  SelectIcon, PointIcon, LineIcon, PolygonIcon, RegularPolygonIcon,
  CircleIcon, BezierIcon, UndoIcon, RedoIcon, DeleteIcon,
  SendBackIcon, SendBackwardIcon, BringForwardIcon, BringFrontIcon,
  ZoomInIcon, ZoomOutIcon, ZoomFitIcon,
  FlipHorizontalIcon, FlipVerticalIcon, RotateCWIcon, RotateCCWIcon,
} from './DrawingIcons'

interface DrawingToolbarProps {
  state: DrawingEditorState
  dispatch: React.Dispatch<DrawingAction>
  deviceId: DeviceId
  backgroundColor: string
  onBackgroundColorChange: (color: string) => void
  foregroundColor: string
  onForegroundColorChange: (color: string) => void
  onMove: (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => void
  onRotate: (index: number, angleDeg: number) => void
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
  const device = DEVICES[deviceId]

  function handleScalingChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === 'proportional') {
      dispatch({
        type: 'SET_SCALING_MODE',
        mode: { type: 'proportional', baseWidth: device.portraitWidth, baseHeight: device.portraitHeight },
      })
    } else {
      dispatch({ type: 'SET_SCALING_MODE', mode: { type: 'fixed' } })
    }
  }

  function announceToolChange(toolTitle: string) {
    setStatusMessage(`${toolTitle} tool selected`)
  }

  const zoomPercent = Math.round(state.zoom * 100)
  const hasSelection = state.selectedItemIndex !== null

  return (
    <div className="drawing-toolbar" role="toolbar" aria-label="Drawing tools">
      {/* Visually hidden live region for screen reader announcements */}
      <div className="visually-hidden" aria-live="polite" role="status">
        {statusMessage}
      </div>

      {/* ── Undo/Redo ── */}
      <div className="drawing-toolbar-group">
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
      </div>

      <div className="drawing-toolbar-separator" />

      {/* ── Tools ── */}
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

      {/* ── Shape Options ── */}
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

      <div className="drawing-toolbar-separator" />

      {/* ── Fill & Stroke ── */}
      <div className="drawing-toolbar-group">
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
      </div>

      <div className="drawing-toolbar-separator" />

      {/* ── FG / BG Colors ── */}
      <div className="drawing-toolbar-group">
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
      </div>

      <div className="drawing-toolbar-separator" />

      {/* ── Layer Controls + Delete ── */}
      <div className="drawing-toolbar-group">
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
      </div>

      <div className="drawing-toolbar-separator" />

      {/* ── Zoom & Scale ── */}
      <div className="drawing-toolbar-group">
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
          <span>Scale</span>
          <select
            className="drawing-scaling-select"
            value={state.scalingMode.type}
            onChange={handleScalingChange}
            title="Scaling mode"
            aria-label="Scaling mode"
          >
            <option value="proportional">Proportional</option>
            <option value="fixed">Fixed for {device.shortName}</option>
          </select>
        </label>
      </div>
    </div>
  )
}
