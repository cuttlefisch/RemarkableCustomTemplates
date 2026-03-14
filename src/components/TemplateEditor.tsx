import { useState, useEffect, useRef } from 'react'
import MonacoEditor from '@monaco-editor/react'
import { parseTemplate } from '../lib/parser'
import { validateCustomName, invertColors, syncBgItemColor } from '../lib/customTemplates'
import { collectMissingConstants } from '../lib/renderer'

export interface TemplateEditorProps {
  json: string
  isCustom: boolean
  pendingName: string
  onPendingNameChange: (name: string) => void
  onApply: (json: string, name: string) => void
  onClose: () => void
  onDelete?: () => void
  existingNames: string[]
}

/**
 * Monaco-backed JSON editor for reMarkable template files.
 * Toolbar provides orientation toggle, dark-mode toggle, Apply, and Close.
 * Validates name, JSON structure, and missing constants before calling onApply().
 * Controlled: caller provides json and handles onApply to persist changes.
 */
export function TemplateEditor({
  json,
  isCustom,
  pendingName,
  onPendingNameChange,
  onApply,
  onClose,
  onDelete,
  existingNames,
}: TemplateEditorProps) {
  const [localJson, setLocalJson] = useState(json)
  const [error, setError] = useState<string | null>(null)
  // Track whether localJson was modified by the user (vs. initialized from prop).
  // Only sync pendingName from JSON content after user edits, not on initial load.
  const userEditedRef = useRef(false)

  // Derive orientation from current JSON (best-effort)
  let isLandscape = false
  try {
    const parsed = JSON.parse(localJson) as { orientation?: string }
    isLandscape = parsed.orientation === 'landscape'
  } catch { /* invalid JSON — ignore */ }

  // Sync editor content when the prop updates (async fetch completes after selection change).
  useEffect(() => {
    setLocalJson(json)  // eslint-disable-line react-hooks/set-state-in-effect
    setError(null)
    userEditedRef.current = false
  }, [json])

  // Sync toolbar name when the user edits the Monaco `name` field.
  // Skipped on initial load so the fork-name suggestion in pendingName is preserved.
  useEffect(() => {
    if (!userEditedRef.current) return
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
    onApply(syncBgItemColor(localJson), pendingName)
  }

  function handleOrientToggle(landscape: boolean) {
    try {
      const parsed = JSON.parse(localJson) as Record<string, unknown>
      setLocalJson(JSON.stringify({ ...parsed, orientation: landscape ? 'landscape' : 'portrait' }, null, 2))
    } catch { /* invalid JSON — ignore */ }
  }

  function handleInvert() {
    try {
      setLocalJson(invertColors(localJson))
    } catch { /* invalid JSON — ignore */ }
  }

  const buttonLabel = isCustom ? 'Apply Changes' : 'Save as New Template'

  return (
    <div className="template-editor">
      <div className="editor-toolbar">
        <span className="editor-name-display">{pendingName}</span>
        <div className="orient-toggle">
          <button
            className={`orient-btn${!isLandscape ? ' active' : ''}`}
            onClick={() => handleOrientToggle(false)}
            title="Portrait"
          >P</button>
          <button
            className={`orient-btn${isLandscape ? ' active' : ''}`}
            onClick={() => handleOrientToggle(true)}
            title="Landscape"
          >LS</button>
        </div>
        <button className="editor-apply-btn" onClick={handleInvert}>Invert</button>
        <button className="editor-apply-btn" onClick={handleApply}>
          {buttonLabel}
        </button>
        {isCustom && onDelete && (
          <button className="editor-delete-btn" onClick={onDelete}>
            Delete
          </button>
        )}
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
          onChange={v => { userEditedRef.current = true; setLocalJson(v ?? '') }}
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
