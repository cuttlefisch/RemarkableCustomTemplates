import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrawingToolbar } from '../components/DrawingToolbar'
import { initialDrawingEditorState } from '../hooks/useDrawingEditor'
import type { DrawingEditorState } from '../hooks/useDrawingEditor'

function renderToolbar(overrides: Partial<DrawingEditorState> = {}) {
  const dispatch = vi.fn()
  const state = { ...initialDrawingEditorState, ...overrides }
  render(
    <DrawingToolbar
      state={state}
      dispatch={dispatch}
      deviceId="rm"
      backgroundColor="#ffffff"
      onBackgroundColorChange={vi.fn()}
      foregroundColor="#000000"
      onForegroundColorChange={vi.fn()}
      onMove={vi.fn()}
      onRotate={vi.fn()}
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
    />,
  )
  return { dispatch }
}

describe('DrawingToolbar', () => {
  it('renders all tool buttons with keybinding hints', () => {
    renderToolbar()
    expect(screen.getByTitle('Select (V)')).toBeDefined()
    expect(screen.getByTitle('Point (M)')).toBeDefined()
    expect(screen.getByTitle('Line (L)')).toBeDefined()
    expect(screen.getByTitle('Polygon (P)')).toBeDefined()
    expect(screen.getByTitle('Regular Polygon (R)')).toBeDefined()
    expect(screen.getByTitle('Circle (C)')).toBeDefined()
    expect(screen.getByTitle('Bezier Curve (B)')).toBeDefined()
  })

  it('active tool has active class', () => {
    renderToolbar({ activeTool: 'line' })
    const lineBtn = screen.getByTitle('Line (L)')
    expect(lineBtn.className).toContain('active')
  })

  it('clicking tool dispatches SET_TOOL', () => {
    const { dispatch } = renderToolbar()
    fireEvent.click(screen.getByTitle('Point (M)'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_TOOL', tool: 'point' })
  })

  it('sides input visible only for regularPolygon tool', () => {
    const { unmount } = render(
      <DrawingToolbar
        state={{ ...initialDrawingEditorState, activeTool: 'line' }}
        dispatch={vi.fn()}
        deviceId="rm"
        backgroundColor="#ffffff"
        onBackgroundColorChange={vi.fn()}
        foregroundColor="#000000"
        onForegroundColorChange={vi.fn()}
        onMove={vi.fn()}
        onRotate={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    )
    expect(screen.queryByTitle('Number of sides')).toBeNull()
    unmount()

    render(
      <DrawingToolbar
        state={{ ...initialDrawingEditorState, activeTool: 'regularPolygon' }}
        dispatch={vi.fn()}
        deviceId="rm"
        backgroundColor="#ffffff"
        onBackgroundColorChange={vi.fn()}
        foregroundColor="#000000"
        onForegroundColorChange={vi.fn()}
        onMove={vi.fn()}
        onRotate={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
      />,
    )
    expect(screen.getByTitle('Number of sides')).toBeDefined()
  })

  it('fill toggle dispatches SET_FILL_ENABLED', () => {
    const { dispatch } = renderToolbar()
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_FILL_ENABLED', enabled: true })
  })

  it('stroke color picker dispatches SET_STROKE_COLOR', () => {
    const { dispatch } = renderToolbar()
    const colorPicker = screen.getByTitle('Stroke color')
    fireEvent.change(colorPicker, { target: { value: '#ff0000' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_STROKE_COLOR', color: '#ff0000' })
  })

  it('delete button disabled when no selection', () => {
    renderToolbar({ selectedItemIndex: null })
    const deleteBtn = screen.getByTitle('Delete selected item (Del)')
    expect(deleteBtn).toHaveProperty('disabled', true)
  })

  it('delete button enabled when item selected', () => {
    renderToolbar({ selectedItemIndex: 2 })
    const deleteBtn = screen.getByTitle('Delete selected item (Del)')
    expect(deleteBtn).toHaveProperty('disabled', false)
  })

  it('scaling dropdown shows current mode', () => {
    renderToolbar()
    const select = screen.getByTitle('Scaling mode') as HTMLSelectElement
    expect(select.value).toBe('proportional')
  })

  it('algorithm selector renders when bezier tool active', () => {
    renderToolbar({ activeTool: 'bezier' })
    expect(screen.getByText('C-R')).toBeDefined()
    expect(screen.getByText('Hobby')).toBeDefined()
  })

  it('algorithm selector does not render for other tools', () => {
    renderToolbar({ activeTool: 'line' })
    expect(screen.queryByText('C-R')).toBeNull()
    expect(screen.queryByText('Hobby')).toBeNull()
  })

  it('clicking algorithm button dispatches SET_BEZIER_ALGORITHM', () => {
    const { dispatch } = renderToolbar({ activeTool: 'bezier' })
    fireEvent.click(screen.getByText('Hobby'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_BEZIER_ALGORITHM', algorithm: 'hobby' })
  })

  it('point shape selector renders when point tool active', () => {
    renderToolbar({ activeTool: 'point' })
    expect(screen.getByTitle('Point shape: dot')).toBeDefined()
    expect(screen.getByTitle('Point shape: cross')).toBeDefined()
    expect(screen.getByTitle('Point shape: diamond')).toBeDefined()
  })

  it('point shape selector does not render for other tools', () => {
    renderToolbar({ activeTool: 'line' })
    expect(screen.queryByTitle('Point shape: dot')).toBeNull()
  })

  // Accessibility tests
  it('toolbar has proper ARIA roles', () => {
    renderToolbar()
    expect(screen.getByRole('toolbar')).toBeDefined()
    expect(screen.getByRole('radiogroup')).toBeDefined()
  })

  it('active tool button has aria-checked=true', () => {
    renderToolbar({ activeTool: 'circle' })
    const circleBtn = screen.getByTitle('Circle (C)')
    expect(circleBtn.getAttribute('aria-checked')).toBe('true')
    const lineBtn = screen.getByTitle('Line (L)')
    expect(lineBtn.getAttribute('aria-checked')).toBe('false')
  })

  it('disabled buttons have aria-disabled', () => {
    renderToolbar()
    const undoBtn = screen.getByTitle('Undo (Ctrl+Z)')
    expect(undoBtn.getAttribute('aria-disabled')).toBe('true')
  })

  it('has visually hidden live region for announcements', () => {
    renderToolbar()
    expect(screen.getByRole('status')).toBeDefined()
  })

  // FG pin tests
  it('renders stroke FG pin button', () => {
    renderToolbar()
    expect(screen.getByTitle('Pin stroke to foreground color')).toBeDefined()
  })

  it('clicking stroke FG pin dispatches SET_STROKE_USE_FOREGROUND', () => {
    const { dispatch } = renderToolbar()
    fireEvent.click(screen.getByTitle('Pin stroke to foreground color'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_STROKE_USE_FOREGROUND', enabled: true })
  })

  it('stroke FG pin shows active class when enabled', () => {
    renderToolbar({ strokeUseForeground: true })
    const btn = screen.getByTitle('Pin stroke to foreground color')
    expect(btn.className).toContain('active')
  })

  it('stroke color picker is disabled when FG pin is active', () => {
    renderToolbar({ strokeUseForeground: true })
    const picker = screen.getByTitle('Stroke color') as HTMLInputElement
    expect(picker.disabled).toBe(true)
  })

  it('fill FG pin button appears when fill is enabled', () => {
    renderToolbar({ fillEnabled: true })
    expect(screen.getByTitle('Pin fill to foreground color')).toBeDefined()
  })

  it('clicking fill FG pin dispatches SET_FILL_USE_FOREGROUND', () => {
    const { dispatch } = renderToolbar({ fillEnabled: true })
    fireEvent.click(screen.getByTitle('Pin fill to foreground color'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_FILL_USE_FOREGROUND', enabled: true })
  })
})
