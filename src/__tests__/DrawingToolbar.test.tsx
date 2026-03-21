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
  it('renders all tool buttons', () => {
    renderToolbar()
    expect(screen.getByTitle('Select')).toBeDefined()
    expect(screen.getByTitle('Point')).toBeDefined()
    expect(screen.getByTitle('Line')).toBeDefined()
    expect(screen.getByTitle('Polygon')).toBeDefined()
    expect(screen.getByTitle('Regular Polygon')).toBeDefined()
    expect(screen.getByTitle('Circle')).toBeDefined()
    expect(screen.getByTitle('Bezier Curve')).toBeDefined()
  })

  it('active tool has active class', () => {
    renderToolbar({ activeTool: 'line' })
    const lineBtn = screen.getByTitle('Line')
    expect(lineBtn.className).toContain('active')
  })

  it('clicking tool dispatches SET_TOOL', () => {
    const { dispatch } = renderToolbar()
    fireEvent.click(screen.getByTitle('Point'))
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
    const deleteBtn = screen.getByTitle('Delete selected item')
    expect(deleteBtn).toHaveProperty('disabled', true)
  })

  it('delete button enabled when item selected', () => {
    renderToolbar({ selectedItemIndex: 2 })
    const deleteBtn = screen.getByTitle('Delete selected item')
    expect(deleteBtn).toHaveProperty('disabled', false)
  })

  it('renders alpha badge', () => {
    renderToolbar()
    expect(screen.getByText('Alpha')).toBeDefined()
  })

  it('scaling dropdown shows current mode', () => {
    renderToolbar()
    const select = screen.getByTitle('Scaling mode') as HTMLSelectElement
    expect(select.value).toBe('proportional')
  })

  it('help button toggles popover visibility', () => {
    renderToolbar()
    expect(screen.queryByText('Drawing Editor Help')).toBeNull()
    fireEvent.click(screen.getByTitle('Drawing help'))
    expect(screen.getByText('Drawing Editor Help')).toBeDefined()
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByText('Drawing Editor Help')).toBeNull()
  })

  it('help popover contains guidance for tools and scaling', () => {
    renderToolbar()
    fireEvent.click(screen.getByTitle('Drawing help'))
    expect(screen.getByText(/Click to place a marker/)).toBeDefined()
    expect(screen.getByText(/Shapes scale to fit any device/)).toBeDefined()
    expect(screen.getByText(/Scroll wheel/)).toBeDefined()
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
})
