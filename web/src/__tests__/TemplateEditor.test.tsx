import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateEditor } from '../components/TemplateEditor'

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
  return render(<TemplateEditor {...defaults} {...overrides} />)
}

// ─── Toolbar rendering ────────────────────────────────────────────────────────

describe('TemplateEditor toolbar', () => {
  it('renders a name input', () => {
    renderEditor()
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
  })

  it('pre-populates name input with pendingName', () => {
    renderEditor({ pendingName: 'My Custom Template' })
    const input = screen.getByRole('textbox', { name: /name/i }) as HTMLInputElement
    expect(input.value).toBe('My Custom Template')
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

  it('calls onPendingNameChange when name input changes', () => {
    const onPendingNameChange = vi.fn()
    renderEditor({ onPendingNameChange })
    const input = screen.getByRole('textbox', { name: /name/i })
    fireEvent.change(input, { target: { value: 'Updated Name' } })
    expect(onPendingNameChange).toHaveBeenCalledWith('Updated Name')
  })
})
