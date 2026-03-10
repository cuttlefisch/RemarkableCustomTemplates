import { useState, useEffect } from 'react'
import './App.css'
import { TemplateCanvas } from './components/TemplateCanvas'
import { parseTemplate } from './lib/parser'
import { parseRegistry } from './lib/registry'
import { DEVICES, type DeviceId } from './lib/renderer'
import type { TemplateRegistry, TemplateRegistryEntry } from './types/registry'
import type { RemarkableTemplate } from './types/template'

export default function App() {
  const [registry, setRegistry] = useState<TemplateRegistry | null>(null)
  const [selected, setSelected] = useState<TemplateRegistryEntry | null>(null)
  const [template, setTemplate] = useState<RemarkableTemplate | null>(null)
  const [loadingRegistry, setLoadingRegistry] = useState(true)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<DeviceId>('rm2')

  // Load the template registry once on mount
  useEffect(() => {
    fetch('/templates/templates.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setRegistry(parseRegistry(data))
        setLoadingRegistry(false)
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

    fetch(`/templates/${encodeURIComponent(selected.filename)}.template`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setTemplate(parseTemplate(data))
        setLoadingTemplate(false)
      })
      .catch(() => {
        setError(`No template file found for "${selected.filename}"`)
        setLoadingTemplate(false)
      })
  }, [selected])

  return (
    <div className="app">

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Templates</span>
          <span className="sidebar-count">
            {registry ? registry.templates.length : '…'}
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

        <div className="sidebar-list">
          {loadingRegistry && <p className="sidebar-hint">Loading…</p>}

          {registry?.templates.map(entry => (
            <button
              key={entry.filename}
              className={`template-btn${selected?.filename === entry.filename ? ' selected' : ''}`}
              onClick={() => setSelected(entry)}
            >
              <span className="template-btn-name">{entry.name}</span>
              <span className={`orient-badge ${entry.landscape ? 'ls' : 'p'}`}>
                {entry.landscape ? 'LS' : 'P'}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Preview ────────────────────────────────────────────── */}
      <main className="preview">
        {selected ? (
          <>
            <div className="preview-meta">
              <h1 className="preview-meta-name">{selected.name}</h1>
              <div className="preview-meta-tags">
                <span className={`tag ${selected.landscape ? 'tag-ls' : 'tag-p'}`}>
                  {selected.landscape ? 'Landscape' : 'Portrait'}
                </span>
                {selected.categories.map(cat => (
                  <span key={cat} className="tag tag-cat">{cat}</span>
                ))}
                <span className="tag tag-file">{selected.filename}</span>
              </div>
            </div>

            <div className="preview-stage">
              {loadingTemplate && <p className="stage-hint">Loading…</p>}
              {error && <p className="stage-hint stage-error">{error}</p>}
              {template && (
                <TemplateCanvas template={template} className="preview-svg" deviceId={deviceId} />
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
