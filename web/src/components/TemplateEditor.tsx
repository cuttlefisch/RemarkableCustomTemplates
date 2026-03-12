import { useState, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { parseTemplate } from '../lib/parser'
import { validateCustomName } from '../lib/customTemplates'
import { collectMissingConstants } from '../lib/renderer'

export interface TemplateEditorProps {
  json: string
  isCustom: boolean
  pendingName: string
  onPendingNameChange: (name: string) => void
  onApply: (json: string, name: string) => void
  onClose: () => void
  existingNames: string[]
}

export function TemplateEditor({
  json,
  isCustom,
  pendingName,
  onPendingNameChange,
  onApply,
  onClose,
  existingNames,
}: TemplateEditorProps) {
  const [localJson, setLocalJson] = useState(json)
  const [error, setError] = useState<string | null>(null)

  // Sync editor content when the prop updates (async fetch completes after selection change)
  useEffect(() => {
    setLocalJson(json)
    setError(null)
  }, [json])

  // Sync toolbar name when the Monaco `name` field changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(localJson) as { name?: unknown }
      if (typeof parsed.name === 'string' && parsed.name !== pendingName) {
        onPendingNameChange(parsed.name)
      }
    } catch { /* invalid JSON — ignore */ }
  }, [localJson, pendingName, onPendingNameChange])

  function handleApply() {
    // Validate name for new custom templates (originals saving as new)
    if (!isCustom) {
      const nameError = validateCustomName(pendingName, existingNames)
      if (nameError) {
        setError(nameError)
        return
      }
    }

    // Validate JSON is not empty
    if (!localJson.trim()) {
      setError('JSON cannot be empty')
      return
    }

    // Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(localJson)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    // Validate it's a valid template
    let tpl: ReturnType<typeof parseTemplate>
    try {
      tpl = parseTemplate(parsed)
    } catch (e) {
      setError(`Invalid template: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    // Validate that all expression identifiers are defined
    const missing = collectMissingConstants(tpl)
    if (missing.length > 0) {
      setError(`Undefined constants: ${missing.join(', ')} — add them to the constants array`)
      return
    }

    setError(null)
    onApply(localJson, pendingName)
  }

  const buttonLabel = isCustom ? 'Apply Changes' : 'Save as New Template'

  return (
    <div className="template-editor">
      <div className="editor-toolbar">
        <label className="editor-name-label" htmlFor="editor-name-input">
          Name
        </label>
        <input
          id="editor-name-input"
          className="editor-name-input"
          type="text"
          value={pendingName}
          onChange={e => onPendingNameChange(e.target.value)}
          placeholder="Template name…"
        />
        <button className="editor-apply-btn" onClick={handleApply}>
          {buttonLabel}
        </button>
        <button className="editor-close-btn" onClick={onClose}>
          Close
        </button>
      </div>

      {error && (
        <div role="alert" className="editor-error">
          {error}
        </div>
      )}

      <div className="editor-monaco">
        <MonacoEditor
          language="json"
          theme="vs-dark"
          value={localJson}
          onChange={v => setLocalJson(v ?? '')}
          options={{
            formatOnPaste: true,
            formatOnType: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
          }}
        />
      </div>
    </div>
  )
}
