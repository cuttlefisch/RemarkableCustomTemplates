import { useState, useEffect, useRef, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import './App.css'
import { TemplateCanvas } from './components/TemplateCanvas'
import { TemplateEditor } from './components/TemplateEditor'
import { parseTemplate } from './lib/parser'
import { parseRegistry } from './lib/registry'
import { buildCustomEntry, buildDefaultTemplate, mergeRegistries, validateCustomName } from './lib/customTemplates'
import { DEVICES, type DeviceId } from './lib/renderer'
import type { TemplateRegistry, TemplateRegistryEntry } from './types/registry'
import type { RemarkableTemplate } from './types/template'

// ─── Canvas error boundary ────────────────────────────────────────────────────

interface CanvasErrorBoundaryProps {
  children: ReactNode
  /** Changing this key resets the boundary after the user fixes the template. */
  resetKey: unknown
}

interface CanvasErrorBoundaryState { error: Error | null }

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(prev: CanvasErrorBoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) { /* logged to console by React */ }

  render() {
    if (this.state.error) {
      return (
        <p className="stage-hint stage-error">
          Render error: {this.state.error.message}
        </p>
      )
    }
    return this.props.children
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Always includes 'Custom' as the first category. */
function mergeCategories(cats: string[]): string[] {
  return ['Custom', ...cats.filter(c => c !== 'Custom')]
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [registry, setRegistry] = useState<TemplateRegistry | null>(null)
  const [customRegistry, setCustomRegistry] = useState<TemplateRegistry>({ templates: [] })
  const [selected, setSelected] = useState<TemplateRegistryEntry | null>(null)
  const [template, setTemplate] = useState<RemarkableTemplate | null>(null)
  const [loadingRegistry, setLoadingRegistry] = useState(true)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<DeviceId>('rm2')

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorJson, setEditorJson] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)

  // New-template inline form
  const [newFormVisible, setNewFormVisible] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateLandscape, setNewTemplateLandscape] = useState(false)
  const [sidebarError, setSidebarError] = useState<string | null>(null)

  // Sidebar filter/sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterOrientation, setFilterOrientation] = useState<'all' | 'portrait' | 'landscape'>('all')

  // Import
  const importInputRef = useRef<HTMLInputElement>(null)

  // Load the template registry + custom registry once on mount
  useEffect(() => {
    const mainFetch = fetch('/templates/templates.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(data => parseRegistry(data))

    const customFetch = fetch('/templates/custom/custom-registry.json')
      .then(r => { if (!r.ok) return { templates: [] }; return r.json() })
      .then(data => {
        try { return parseRegistry(data) } catch { return { templates: [] } }
      })

    Promise.all([mainFetch, customFetch])
      .then(([main, custom]) => {
        setRegistry(main)
        // Sync categories from each custom template's JSON so the registry is
        // always in agreement with the file, even if custom-registry.json is stale.
        return Promise.all(
          custom.templates.map(async entry => {
            try {
              const slug = entry.filename.split('/').map(s => encodeURIComponent(s)).join('/')
              const r = await fetch(`/templates/${slug}.template`)
              if (!r.ok) return entry
              const data = await r.json()
              const tpl = parseTemplate(data)
              const synced = mergeCategories(tpl.categories)
              return { ...entry, categories: synced }
            } catch {
              return entry
            }
          }),
        ).then(syncedTemplates => {
          setCustomRegistry({ templates: syncedTemplates })
          setLoadingRegistry(false)
        })
      })
      .catch(e => {
        setError(`Failed to load registry: ${String(e)}`)
        setLoadingRegistry(false)
      })
  }, [])

  // Fetch and parse the selected template file
  useEffect(() => {
    if (!selected) return
    setLoadingTemplate(true)
    setError(null)
    setTemplate(null)

    // Encode each path segment separately so custom/my-grid stays custom/my-grid
    const fetchPath = selected.filename
      .split('/')
      .map(seg => encodeURIComponent(seg))
      .join('/')

    fetch(`/templates/${fetchPath}.template`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const parsed = parseTemplate(data)
        setTemplate(parsed)
        setEditorJson(JSON.stringify(data, null, 2))
        setPendingName(selected.filename.startsWith('custom/') ? selected.name : `My ${selected.name}`)
        setLoadingTemplate(false)
      })
      .catch(() => {
        setError(`No template file found for "${selected.filename}"`)
        setLoadingTemplate(false)
      })
  }, [selected])

  const mergedRegistry = registry ? mergeRegistries(registry, customRegistry) : null

  const existingCustomNames = customRegistry.templates.map(t => t.name)

  // Derived: all unique categories from merged registry
  const allCategories = mergedRegistry
    ? [...new Set(mergedRegistry.templates.flatMap(t => t.categories))].sort()
    : []

  // Derived: filtered + sorted template list
  const filteredTemplates = (mergedRegistry?.templates ?? [])
    .filter(t => {
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (filterCategory && !t.categories.includes(filterCategory)) return false
      if (filterOrientation === 'portrait' && t.landscape === true) return false
      if (filterOrientation === 'landscape' && t.landscape !== true) return false
      return true
    })
    .sort((a, b) => {
      if (a.landscape !== b.landscape) return a.landscape ? 1 : -1
      return a.name.localeCompare(b.name)
    })

  async function handleApply(json: string, name: string) {
    setEditorError(null)
    if (!selected) return

    try {
      const parsed = JSON.parse(json) as Record<string, unknown>
      const tpl = parseTemplate(parsed)
      const newLandscape = tpl.orientation === 'landscape'

      if (selected.filename.startsWith('custom/')) {
        const oldSlug = selected.filename.replace('custom/', '')
        const isRename = name !== selected.name
        const orientationChanged = newLandscape !== (selected.landscape ?? false)

        if (isRename || orientationChanged) {
          // Validate new name only if actually renaming
          if (isRename) {
            const otherNames = existingCustomNames.filter(n => n !== selected.name)
            const nameErr = validateCustomName(name, otherNames)
            if (nameErr) { setEditorError(nameErr); return }
          }

          const renamedEntry = buildCustomEntry(name, newLandscape, mergeCategories(tpl.categories))
          const newSlug = renamedEntry.filename.replace('custom/', '')
          const updatedContent = JSON.stringify(
            { ...parsed, name, categories: mergeCategories(tpl.categories) }, null, 2,
          )
          const res = await fetch(`/api/custom-templates/${encodeURIComponent(oldSlug)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newSlug, newName: name, content: updatedContent }),
          })
          if (!res.ok) throw new Error(`Server error: ${res.status}`)
          setCustomRegistry(prev => ({
            templates: prev.templates.map(e =>
              e.filename === selected.filename ? renamedEntry : e,
            ),
          }))
          setSelected(renamedEntry)
          setEditorJson(updatedContent)
          setTemplate(tpl)
        } else {
          // Content-only update — sync categories to registry entry too
          const updatedEntry = buildCustomEntry(name, newLandscape, mergeCategories(tpl.categories))
          const updatedContent = JSON.stringify(
            { ...parsed, name, categories: mergeCategories(tpl.categories) }, null, 2,
          )
          const res = await fetch(`/api/custom-templates/${encodeURIComponent(oldSlug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: updatedContent, entry: updatedEntry }),
          })
          if (!res.ok) throw new Error(`Server error: ${res.status}`)
          setCustomRegistry(prev => ({
            templates: prev.templates.map(e =>
              e.filename === selected.filename ? updatedEntry : e,
            ),
          }))
          setSelected(updatedEntry)
          setEditorJson(updatedContent)
          setTemplate(tpl)
        }
      } else {
        // Save original as new custom template
        const entry = buildCustomEntry(name, newLandscape, mergeCategories(tpl.categories))
        const slug = entry.filename.replace('custom/', '')
        const updatedContent = JSON.stringify(
          { ...parsed, name, categories: mergeCategories(tpl.categories) }, null, 2,
        )
        const res = await fetch('/api/custom-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: slug, content: updatedContent, entry }),
        })
        if (!res.ok) throw new Error(`Server error: ${res.status}`)

        setCustomRegistry(prev => ({ templates: [entry, ...prev.templates] }))
        setSelected(entry)
        // Let the useEffect re-fetch from disk
      }
    } catch (e) {
      setEditorError(`Failed to save: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleCreateNew() {
    setSidebarError(null)
    const nameErr = validateCustomName(newTemplateName.trim(), existingCustomNames)
    if (nameErr) { setSidebarError(nameErr); return }

    try {
      const name = newTemplateName.trim()
      const entry = buildCustomEntry(name, newTemplateLandscape)
      const slug = entry.filename.replace('custom/', '')
      const content = buildDefaultTemplate(name, newTemplateLandscape)
      const res = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: slug, content, entry }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setCustomRegistry(prev => ({ templates: [entry, ...prev.templates] }))
      setSelected(entry)
      setNewFormVisible(false)
      setNewTemplateName('')
      setEditorOpen(true)
    } catch (e) {
      setSidebarError(`Failed to create: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSidebarError(null)
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''  // allow re-importing same file

    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setSidebarError('File is not valid JSON')
      return
    }

    let tpl: RemarkableTemplate
    try {
      tpl = parseTemplate(raw)
    } catch (e) {
      setSidebarError(`Invalid template: ${e instanceof Error ? e.message : String(e)}`)
      return
    }

    const name = tpl.name
    const landscape = tpl.orientation === 'landscape'
    const nameErr = validateCustomName(name, existingCustomNames)
    if (nameErr) { setSidebarError(nameErr); return }

    try {
      const entry = buildCustomEntry(name, landscape, mergeCategories(tpl.categories))
      const slug = entry.filename.replace('custom/', '')
      const rawObj = raw as Record<string, unknown>
      const updatedContent = JSON.stringify(
        { ...rawObj, categories: mergeCategories(tpl.categories) }, null, 2,
      )
      const res = await fetch('/api/custom-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: slug, content: updatedContent, entry }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setCustomRegistry(prev => ({ templates: [entry, ...prev.templates] }))
      setSelected(entry)
    } catch (e) {
      setSidebarError(`Failed to import: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const anyFilterActive = !!(searchQuery || filterCategory || filterOrientation !== 'all')

  return (
    <div className={`app${editorOpen ? ' editing' : ''}`}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Templates</span>
          <span className="sidebar-count">
            {mergedRegistry ? filteredTemplates.length : '…'}
          </span>
        </div>

        <div className="device-selector">
          {Object.values(DEVICES).map(spec => (
            <button
              key={spec.id}
              className={`device-btn${deviceId === spec.id ? ' active' : ''}`}
              onClick={() => setDeviceId(spec.id as DeviceId)}
              title={spec.name}
            >
              {spec.shortName}
            </button>
          ))}
        </div>

        <div className="sidebar-actions">
          <button
            className={`sidebar-action-btn${newFormVisible ? ' active' : ''}`}
            onClick={() => { setNewFormVisible(v => !v); setSidebarError(null) }}
          >
            + New
          </button>
          <button className="sidebar-action-btn" onClick={() => importInputRef.current?.click()}>
            ↑ Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".template"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        {newFormVisible && (
          <div className="new-template-form">
            <input
              className="new-template-name"
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateNew()}
              placeholder="Template name…"
              autoFocus
            />
            <div className="orient-toggle">
              <button
                className={`orient-btn${!newTemplateLandscape ? ' active' : ''}`}
                onClick={() => setNewTemplateLandscape(false)}
              >P</button>
              <button
                className={`orient-btn${newTemplateLandscape ? ' active' : ''}`}
                onClick={() => setNewTemplateLandscape(true)}
              >LS</button>
            </div>
            <button className="new-template-create-btn" onClick={handleCreateNew}>
              Create
            </button>
          </div>
        )}

        {sidebarError && (
          <div className="sidebar-error">{sidebarError}</div>
        )}

        {/* ── Sidebar filters ── */}
        <div className="sidebar-filters">
          <input
            className="sidebar-search"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by name…"
          />
          <div className="sidebar-filter-row">
            <div className="orient-toggle">
              <button
                className={`orient-btn${filterOrientation === 'all' ? ' active' : ''}`}
                onClick={() => setFilterOrientation('all')}
              >All</button>
              <button
                className={`orient-btn${filterOrientation === 'portrait' ? ' active' : ''}`}
                onClick={() => setFilterOrientation('portrait')}
              >P</button>
              <button
                className={`orient-btn${filterOrientation === 'landscape' ? ' active' : ''}`}
                onClick={() => setFilterOrientation('landscape')}
              >LS</button>
            </div>
          </div>
          {allCategories.length > 0 && (
            <div className="cat-chips">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  className={`cat-chip${filterCategory === cat ? ' active' : ''}`}
                  onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {anyFilterActive && (
            <button
              className="filter-clear"
              onClick={() => { setSearchQuery(''); setFilterCategory(null); setFilterOrientation('all') }}
            >× Clear filters</button>
          )}
        </div>

        <div className="sidebar-list">
          {loadingRegistry && <p className="sidebar-hint">Loading…</p>}
          {filteredTemplates.map(entry => (
            <button
              key={`${entry.filename}::${entry.landscape ?? false}`}
              className={`template-btn${selected?.filename === entry.filename && selected?.landscape === entry.landscape ? ' selected' : ''}`}
              onClick={() => setSelected(entry)}
            >
              <span className="template-btn-name">{entry.name}</span>
              <span className={`orient-badge ${entry.isCustom ? 'custom' : (entry.landscape ? 'ls' : 'p')}`}>
                {entry.landscape ? 'LS' : 'P'}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Editor panel (only when open) ───────────────────────── */}
      {editorOpen && selected && (
        <div className="editor-panel">
          <TemplateEditor
            key={selected.filename}
            json={editorJson}
            isCustom={selected.isCustom ?? false}
            pendingName={pendingName}
            onPendingNameChange={setPendingName}
            onApply={handleApply}
            onClose={() => setEditorOpen(false)}
            existingNames={existingCustomNames}
          />
          {editorError && (
            <div className="editor-panel-error">{editorError}</div>
          )}
        </div>
      )}

      {/* ── Preview ────────────────────────────────────────────── */}
      <main className="preview">
        {selected ? (
          <>
            <div className="preview-meta">
              <div className="preview-meta-top">
                <h1 className="preview-meta-name">{selected.name}</h1>
                <button
                  className={`edit-json-btn${editorOpen ? ' active' : ''}`}
                  onClick={() => setEditorOpen(o => !o)}
                  disabled={!template}
                >
                  {editorOpen ? 'Close Editor' : 'Edit JSON'}
                </button>
              </div>
              <div className="preview-meta-tags">
                <button
                  className={`tag ${selected.landscape ? 'tag-ls' : 'tag-p'}${filterOrientation === (selected.landscape ? 'landscape' : 'portrait') ? ' tag-active' : ''}`}
                  onClick={() => {
                    const thisOrient = selected.landscape ? 'landscape' : 'portrait'
                    setFilterOrientation(filterOrientation === thisOrient ? 'all' : thisOrient)
                  }}
                >
                  {selected.landscape ? 'Landscape' : 'Portrait'}
                </button>
                {selected.isCustom && <span className="tag tag-custom">Custom</span>}
                {(template?.categories ?? selected.categories)
                  .filter(cat => !(selected.isCustom && cat === 'Custom'))
                  .map(cat => (
                  <button
                    key={cat}
                    className={`tag tag-cat${filterCategory === cat ? ' tag-active' : ''}`}
                    onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                  >
                    {cat}
                  </button>
                ))}
                {selected.isCustom ? (() => {
                  const slug = selected.filename.replace('custom/', '')
                  const encodedPath = selected.filename
                    .split('/')
                    .map(seg => encodeURIComponent(seg))
                    .join('/')
                  return (
                    <a
                      className="tag tag-file tag-download"
                      href={`/templates/${encodedPath}.template`}
                      download={`${slug}.template`}
                    >
                      {selected.filename}.template ↓
                    </a>
                  )
                })() : (
                  <span className="tag tag-file">{selected.filename}</span>
                )}
              </div>
            </div>

            <div className="preview-stage">
              {loadingTemplate && <p className="stage-hint">Loading…</p>}
              {error && <p className="stage-hint stage-error">{error}</p>}
              {template && (
                <CanvasErrorBoundary resetKey={editorJson}>
                  <TemplateCanvas template={template} className="preview-svg" deviceId={deviceId} />
                </CanvasErrorBoundary>
              )}
            </div>
          </>
        ) : (
          <div className="preview-stage">
            <p className="stage-hint">← Select a template to preview</p>
          </div>
        )}
      </main>

    </div>
  )
}
