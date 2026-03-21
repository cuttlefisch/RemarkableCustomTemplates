/**
 * DrawingToolbar — tool selection, property controls, and scaling mode for the drawing editor.
 */

import { useState } from 'react'
import type { DrawingEditorState, DrawingAction, DrawingTool } from '../hooks/useDrawingEditor'
import { DEVICES, type DeviceId } from '../lib/renderer'

interface DrawingToolbarProps {
  state: DrawingEditorState
  dispatch: React.Dispatch<DrawingAction>
  deviceId: DeviceId
}

const STROKE_WIDTHS = [1, 2, 3, 5, 8]

const TOOLS: { tool: DrawingTool; label: string; title: string }[] = [
  { tool: 'select', label: '↖', title: 'Select' },
  { tool: 'point', label: '·', title: 'Point' },
  { tool: 'line', label: '/', title: 'Line' },
  { tool: 'polygon', label: '⬠', title: 'Polygon' },
  { tool: 'regularPolygon', label: '⬡', title: 'Regular Polygon' },
]

export function DrawingToolbar({ state, dispatch, deviceId }: DrawingToolbarProps) {
  const [helpOpen, setHelpOpen] = useState(false)
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
            <li><strong>Select (↖):</strong> Click items to select them for deletion or moving.</li>
            <li><strong>Point (·):</strong> Click to place a cross marker.</li>
            <li><strong>Line (/):</strong> Click start point, then click end point.</li>
            <li><strong>Polygon (⬠):</strong> Click to add vertices. Click near the first vertex to close (min 3 vertices).</li>
            <li><strong>Regular Polygon (⬡):</strong> Click to set center, then click to set radius.</li>
          </ul>
          <p><strong>Scaling:</strong></p>
          <ul>
            <li><strong>Proportional:</strong> Shapes scale to fit any device. Best when devices share the same aspect ratio.</li>
            <li><strong>Fixed:</strong> Pixel-perfect coordinates locked to the current device.</li>
          </ul>
          <p><strong>Tips:</strong></p>
          <ul>
            <li>Press <kbd>Escape</kbd> to cancel an in-progress shape.</li>
            <li>Click near the first vertex to close a polygon.</li>
            <li>Shapes are added as JSON items — you can edit them in the JSON editor.</li>
            <li>&ldquo;Drawn&rdquo; templates may look different on devices with different aspect ratios.</li>
          </ul>
          <button className="drawing-help-close" onClick={() => setHelpOpen(false)}>Got it</button>
        </div>
      )}

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
        <input
          type="color"
          className="drawing-color-picker"
          value={state.fillColor}
          onChange={e => dispatch({ type: 'SET_FILL_COLOR', color: e.target.value })}
          title="Fill color"
        />
      )}

      <input
        type="color"
        className="drawing-color-picker"
        value={state.strokeColor}
        onChange={e => dispatch({ type: 'SET_STROKE_COLOR', color: e.target.value })}
        title="Stroke color"
      />

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

      <div className="drawing-toolbar-separator" />

      <select
        className="drawing-scaling-select"
        value={state.scalingMode.type}
        onChange={handleScalingChange}
        title="Scaling mode"
      >
        <option value="proportional">Proportional</option>
        <option value="fixed">Fixed for {device.shortName}</option>
      </select>

      <div className="drawing-toolbar-separator" />

      <button
        className="drawing-tool-btn drawing-delete-btn"
        disabled={state.selectedItemIndex === null}
        onClick={() => dispatch({ type: 'DELETE_SELECTED' })}
        title="Delete selected item"
      >
        ✕
      </button>
    </div>
  )
}
