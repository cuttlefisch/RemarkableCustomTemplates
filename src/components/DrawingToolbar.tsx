/**
 * DrawingToolbar — tool selection, property controls, zoom, layering,
 * rotation, undo/redo, and scaling mode for the drawing editor.
 */

import { useState } from 'react'
import type { DrawingEditorState, DrawingAction, DrawingTool, PointShape, BezierAlgorithm } from '../hooks/useDrawingEditor'
import { DEVICES, type DeviceId } from '../lib/renderer'

interface DrawingToolbarProps {
  state: DrawingEditorState
  dispatch: React.Dispatch<DrawingAction>
  deviceId: DeviceId
  backgroundColor: string
  onBackgroundColorChange: (color: string) => void
  onMove: (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => void
  onRotate: (index: number, angleDeg: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

const STROKE_WIDTHS = [1, 2, 3, 5, 8]

const TOOLS: { tool: DrawingTool; label: string; title: string }[] = [
  { tool: 'select', label: '↖', title: 'Select' },
  { tool: 'point', label: '·', title: 'Point' },
  { tool: 'line', label: '/', title: 'Line' },
  { tool: 'polygon', label: '⬠', title: 'Polygon' },
  { tool: 'regularPolygon', label: '⬡', title: 'Regular Polygon' },
  { tool: 'circle', label: '○', title: 'Circle' },
  { tool: 'bezier', label: '〰', title: 'Bezier Curve' },
]

export function DrawingToolbar({
  state,
  dispatch,
  deviceId,
  backgroundColor,
  onBackgroundColorChange,
  onMove,
  onRotate,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: DrawingToolbarProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [rotationDeg, setRotationDeg] = useState('0')
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

  const zoomPercent = Math.round(state.zoom * 100)
  const hasSelection = state.selectedItemIndex !== null

  return (
    <div className="drawing-toolbar">
      <span className="drawing-alpha-badge">Alpha</span>

      <button
        className={`drawing-tool-btn drawing-help-btn${helpOpen ? ' active' : ''}`}
        onClick={() => setHelpOpen(v => !v)}
        title="Drawing help"
      >
        ?
      </button>

      {helpOpen && (
        <div className="drawing-help-popover">
          <h4>Drawing Editor Help</h4>
          <p><strong>Tools:</strong></p>
          <ul>
            <li><strong>Select (↖):</strong> Click items to select them for deletion, moving, or rotating.</li>
            <li><strong>Point (·):</strong> Click to place a marker. Choose shape: dot (●), cross (✕), or diamond (◇).</li>
            <li><strong>Line (/):</strong> Click start point, then click end point.</li>
            <li><strong>Polygon (⬠):</strong> Click to add vertices. Click near the first vertex to close (min 3 vertices).</li>
            <li><strong>Regular Polygon (⬡):</strong> Click to set center, then click to set radius.</li>
            <li><strong>Circle (○):</strong> Click to set center, then click to set radius.</li>
            <li><strong>Bezier (〰):</strong> Click to place anchor points. Click near first vertex to close, or press <kbd>Enter</kbd> to finish open path.</li>
          </ul>
          <p><strong>Navigation:</strong></p>
          <ul>
            <li><strong>Zoom:</strong> Scroll wheel, or use +/- buttons.</li>
            <li><strong>Pan:</strong> Hold <kbd>Space</kbd> and drag, or middle-click drag.</li>
            <li><strong>Undo/Redo:</strong> <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Shift+Z</kbd></li>
          </ul>
          <p><strong>Scaling:</strong></p>
          <ul>
            <li><strong>Proportional:</strong> Shapes scale to fit any device.</li>
            <li><strong>Fixed:</strong> Pixel-perfect coordinates locked to the current device.</li>
            <li>Changing the scaling mode only affects newly drawn shapes. Existing shapes keep their original scaling.</li>
          </ul>
          <button className="drawing-help-close" onClick={() => setHelpOpen(false)}>Got it</button>
        </div>
      )}

      <div className="drawing-toolbar-separator" />

      {/* Undo/Redo */}
      <button
        className="drawing-tool-btn"
        disabled={!canUndo}
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        className="drawing-tool-btn"
        disabled={!canRedo}
        onClick={onRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </button>

      <div className="drawing-toolbar-separator" />

      {TOOLS.map(({ tool, label, title }) => (
        <button
          key={tool}
          className={`drawing-tool-btn${state.activeTool === tool ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TOOL', tool })}
          title={title}
        >
          {label}
        </button>
      ))}

      {state.activeTool === 'regularPolygon' && (
        <input
          type="number"
          className="drawing-sides-input"
          min={3}
          max={12}
          value={state.regularPolygonSides}
          onChange={e => dispatch({ type: 'SET_REGULAR_SIDES', sides: Math.max(3, Math.min(12, parseInt(e.target.value) || 3)) })}
          title="Number of sides"
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
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="drawing-toolbar-separator" />

      <label className="drawing-fill-toggle" title="Fill">
        <input
          type="checkbox"
          checked={state.fillEnabled}
          onChange={e => dispatch({ type: 'SET_FILL_ENABLED', enabled: e.target.checked })}
        />
        Fill
      </label>
      {state.fillEnabled && (
        <label className="drawing-color-label">
          <input
            type="color"
            className="drawing-color-picker"
            value={state.fillColor}
            onChange={e => dispatch({ type: 'SET_FILL_COLOR', color: e.target.value })}
            title="Fill color"
          />
        </label>
      )}

      <label className="drawing-color-label">
        <span>Stroke</span>
        <input
          type="color"
          className="drawing-color-picker"
          value={state.strokeColor}
          onChange={e => dispatch({ type: 'SET_STROKE_COLOR', color: e.target.value })}
          title="Stroke color"
        />
      </label>

      <label className="drawing-color-label">
        <span>Width</span>
        <select
          className="drawing-stroke-width-select"
          value={state.strokeWidth}
          onChange={e => dispatch({ type: 'SET_STROKE_WIDTH', width: Number(e.target.value) })}
          title="Stroke width"
        >
          {STROKE_WIDTHS.map(w => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>
      </label>

      <label className="drawing-color-label">
        <span>BG</span>
        <input
          type="color"
          className="drawing-color-picker"
          value={backgroundColor}
          onChange={e => onBackgroundColorChange(e.target.value)}
          title="Background color"
        />
      </label>

      <div className="drawing-toolbar-separator" />

      <label className="drawing-color-label">
        <span>Scale</span>
        <select
          className="drawing-scaling-select"
          value={state.scalingMode.type}
          onChange={handleScalingChange}
          title="Scaling mode"
        >
          <option value="proportional">Proportional</option>
          <option value="fixed">Fixed for {device.shortName}</option>
        </select>
      </label>

      <div className="drawing-toolbar-separator" />

      {/* Zoom controls */}
      <div className="drawing-zoom-controls">
        <button
          className="drawing-tool-btn"
          onClick={() => {
            const newZoom = Math.max(0.1, state.zoom - 0.25)
            dispatch({ type: 'ZOOM', zoom: newZoom, pan: state.panOffset })
          }}
          title="Zoom out"
        >
          −
        </button>
        <span className="drawing-zoom-label">{zoomPercent}%</span>
        <button
          className="drawing-tool-btn"
          onClick={() => {
            const newZoom = Math.min(10, state.zoom + 0.25)
            dispatch({ type: 'ZOOM', zoom: newZoom, pan: state.panOffset })
          }}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="drawing-tool-btn"
          onClick={() => dispatch({ type: 'ZOOM_TO_FIT' })}
          title="Zoom to fit"
        >
          Fit
        </button>
      </div>

      <div className="drawing-toolbar-separator" />

      {/* Layer controls (when selected) */}
      {hasSelection && (
        <>
          <div className="drawing-layer-controls">
            <button
              className="drawing-layer-btn"
              onClick={() => onMove(state.selectedItemIndex!, 'bottom')}
              title="Move to bottom"
            >
              ⤓
            </button>
            <button
              className="drawing-layer-btn"
              onClick={() => onMove(state.selectedItemIndex!, 'down')}
              title="Move back"
            >
              ↓
            </button>
            <button
              className="drawing-layer-btn"
              onClick={() => onMove(state.selectedItemIndex!, 'up')}
              title="Move front"
            >
              ↑
            </button>
            <button
              className="drawing-layer-btn"
              onClick={() => onMove(state.selectedItemIndex!, 'top')}
              title="Move to top"
            >
              ⤒
            </button>
          </div>

          {/* Rotation */}
          <input
            type="number"
            className="drawing-rotation-input"
            value={rotationDeg}
            onChange={e => setRotationDeg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const deg = parseFloat(rotationDeg)
                if (!isNaN(deg) && deg !== 0) {
                  onRotate(state.selectedItemIndex!, deg)
                  setRotationDeg('0')
                }
              }
            }}
            title="Rotation degrees (press Enter)"
            placeholder="0°"
          />
          <button
            className="drawing-tool-btn"
            onClick={() => {
              const deg = parseFloat(rotationDeg)
              if (!isNaN(deg) && deg !== 0) {
                onRotate(state.selectedItemIndex!, deg)
                setRotationDeg('0')
              }
            }}
            title="Apply rotation"
          >
            ↻
          </button>

          <div className="drawing-toolbar-separator" />
        </>
      )}

      <button
        className="drawing-tool-btn drawing-delete-btn"
        disabled={!hasSelection}
        onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
        title="Delete selected item"
      >
        ✕
      </button>
    </div>
  )
}
