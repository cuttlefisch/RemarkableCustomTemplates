import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateEditor } from '../components/TemplateEditor'
import { ThemeContext } from '../hooks/useTheme'
import { themes } from '../themes/themes'

// ─── Mock Monaco ───────────────────────────────────────────────────────────────
// Monaco requires a real browser DOM and worker threads. We replace it with a
// plain <textarea> so component logic is testable in jsdom.

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_JSON = JSON.stringify({
  name: 'Test',
  author: 'test',
  templateVersion: '1.0.0',
  formatVersion: 1,
  categories: ['Lines'],
  orientation: 'portrait',
  constants: [],
  items: [],
})

function renderEditor(overrides: Partial<React.ComponentProps<typeof TemplateEditor>> = {}) {
  const defaults = {
    json: VALID_JSON,
    isCustom: false,
    pendingName: 'My Test',
    onPendingNameChange: vi.fn(),
    onApply: vi.fn(),
    onClose: vi.fn(),
    existingNames: [],
  }
  const themeCtx = { theme: themes[0], setTheme: vi.fn(), themes }
  return render(
    <ThemeContext.Provider value={themeCtx}>
      <TemplateEditor {...defaults} {...overrides} />
    </ThemeContext.Provider>
  )
}

// ─── Toolbar rendering ────────────────────────────────────────────────────────

describe('TemplateEditor toolbar', () => {
  it('renders a name display', () => {
    renderEditor({ pendingName: 'Test Template' })
    expect(screen.getByText('Test Template')).toBeInTheDocument()
  })

  it('displays pendingName in name display', () => {
    renderEditor({ pendingName: 'My Custom Template' })
    expect(screen.getByText('My Custom Template')).toBeInTheDocument()
  })

  it('shows "Save as New Template" for original (non-custom) templates', () => {
    renderEditor({ isCustom: false })
    expect(screen.getByRole('button', { name: /save as new template/i })).toBeInTheDocument()
  })

  it('shows "Apply Changes" for custom templates', () => {
    renderEditor({ isCustom: true })
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument()
  })

  it('renders a Close button', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn()
    renderEditor({ onClose })
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ─── Apply with invalid JSON ──────────────────────────────────────────────────

describe('TemplateEditor apply validation', () => {
  it('shows error when JSON is empty and Apply clicked', () => {
    renderEditor({ json: '' })
    const editor = screen.getByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save as new template|apply changes/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows parse error when JSON is malformed', () => {
    renderEditor({ json: '{invalid json' })
    const editor = screen.getByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: '{invalid json' } })
    fireEvent.click(screen.getByRole('button', { name: /save as new template|apply changes/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows error when name is empty for original template', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: false, pendingName: '', onApply })
    fireEvent.click(screen.getByRole('button', { name: /save as new template/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('shows duplicate name error for original template', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: false, pendingName: 'Existing', existingNames: ['Existing'], onApply })
    fireEvent.click(screen.getByRole('button', { name: /save as new template/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('shows error when template references an undefined constant', () => {
    const brokenJson = JSON.stringify({
      name: 'Broken', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Lines'], orientation: 'portrait', constants: [],
      items: [{ type: 'group',
                boundingBox: { x: 'missingVar', y: 0, width: 100, height: 100 },
                children: [] }],
    })
    renderEditor({ isCustom: true, pendingName: 'Broken', json: brokenJson })
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    expect(screen.getByRole('alert').textContent).toMatch(/missingVar/)
  })

  it('does not crash when orientation toggle is clicked with invalid JSON', () => {
    renderEditor({ json: '{bad json' })
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'LS' }))).not.toThrow()
  })
})

// ─── Orientation toggle ───────────────────────────────────────────────────────

describe('TemplateEditor orientation toggle', () => {
  it('renders P and LS buttons', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'P' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LS' })).toBeInTheDocument()
  })

  it('P button is active for portrait template', () => {
    renderEditor()  // VALID_JSON has portrait orientation
    expect(screen.getByRole('button', { name: 'P' }).className).toContain('active')
  })

  it('LS button becomes active after clicking it', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'LS' }))
    expect(screen.getByRole('button', { name: 'LS' }).className).toContain('active')
  })

  it('clicking LS updates orientation in applied JSON', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: true, pendingName: 'My Grid', onApply })
    fireEvent.click(screen.getByRole('button', { name: 'LS' }))
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    const appliedJson = JSON.parse(onApply.mock.calls[0][0])
    expect(appliedJson.orientation).toBe('landscape')
  })

  it('clicking P restores portrait orientation', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: true, pendingName: 'My Grid', onApply })
    fireEvent.click(screen.getByRole('button', { name: 'LS' }))
    fireEvent.click(screen.getByRole('button', { name: 'P' }))
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    const appliedJson = JSON.parse(onApply.mock.calls[0][0])
    expect(appliedJson.orientation).toBe('portrait')
  })
})

// ─── Invert button ────────────────────────────────────────────────────────────

describe('TemplateEditor invert button', () => {
  it('renders Invert button', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: 'Invert' })).toBeInTheDocument()
  })

  it('clicking Invert swaps fg/bg constants in applied JSON', () => {
    const withColors = JSON.stringify({
      name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
      categories: ['Lines'], orientation: 'portrait',
      constants: [{ foreground: '#000000' }, { background: '#ffffff' }],
      items: [],
    })
    const onApply = vi.fn()
    renderEditor({ json: withColors, isCustom: true, pendingName: 'My Grid', onApply })
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }))
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    const appliedJson = JSON.parse(onApply.mock.calls[0][0]) as {
      constants: Record<string, string>[]
    }
    const fg = appliedJson.constants.find(e => 'foreground' in e)?.foreground
    const bg = appliedJson.constants.find(e => 'background' in e)?.background
    expect(fg).toBe('#ffffff')
    expect(bg).toBe('#000000')
  })

  it('does not add or remove Dark category when Invert is clicked', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: true, pendingName: 'My Grid', onApply })
    fireEvent.click(screen.getByRole('button', { name: 'Invert' }))
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    const appliedJson = JSON.parse(onApply.mock.calls[0][0]) as { categories: string[] }
    expect(appliedJson.categories).not.toContain('Dark')
  })
})

// ─── Delete button ────────────────────────────────────────────────────────────

describe('TemplateEditor delete button', () => {
  it('renders when isCustom=true', () => {
    renderEditor({ isCustom: true, onDelete: vi.fn() })
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('does not render when isCustom=false', () => {
    renderEditor({ isCustom: false })
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('calls onDelete when clicked', () => {
    const onDelete = vi.fn()
    renderEditor({ isCustom: true, onDelete })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})

// ─── Successful apply ─────────────────────────────────────────────────────────

describe('TemplateEditor successful apply', () => {
  it('calls onApply with json and name for original template', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: false, pendingName: 'New Name', onApply })
    // Trigger apply with valid JSON
    fireEvent.click(screen.getByRole('button', { name: /save as new template/i }))
    expect(onApply).toHaveBeenCalledWith(VALID_JSON, 'New Name')
  })

  it('calls onApply for custom template without requiring name change', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: true, pendingName: 'Existing Custom', onApply })
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    expect(onApply).toHaveBeenCalledWith(VALID_JSON, 'Existing Custom')
  })

  it('clears error after successful apply', () => {
    const onApply = vi.fn()
    renderEditor({ isCustom: true, pendingName: 'My Grid', onApply })
    // First trigger an error by emptying the editor
    const editor = screen.getByTestId('monaco-editor')
    fireEvent.change(editor, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Now fix the JSON and apply again
    fireEvent.change(editor, { target: { value: VALID_JSON } })
    fireEvent.click(screen.getByRole('button', { name: /apply changes/i }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

})
