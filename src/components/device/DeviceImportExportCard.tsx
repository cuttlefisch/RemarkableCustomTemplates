import { useState, useRef, useEffect } from 'react'

interface Props {
  /** Whether official (classic) templates have been imported. null = still checking. */
  officialTemplatesAvailable: boolean | null
  /** Callback to display a success message in the parent page. */
  onStatus: (msg: string) => void
  /** Callback to display an error message in the parent page. */
  onError: (msg: string) => void
  /** Called after operations that change the template registry (e.g. restoring samples). */
  onRefreshRegistry?: () => void
}

/**
 * Import and export card on the Device page.
 * Provides classic template folder import, ZIP export (classic and rm_methods formats),
 * and management of hidden system templates and notebooks.
 */
export function DeviceImportExportCard({ officialTemplatesAvailable, onStatus, onError, onRefreshRegistry }: Props) {
  const [importing, setImporting] = useState(false)
  const [showImportHelp, setShowImportHelp] = useState(false)
  const officialInputRef = useRef<HTMLInputElement>(null)
  const [hiddenSamplesCount, setHiddenSamplesCount] = useState<number | null>(null)
  const [hiddenNotebooksCount, setHiddenNotebooksCount] = useState<number | null>(null)
  const [restoringAllSamples, setRestoringAllSamples] = useState(false)
  const [restoringAllNotebooks, setRestoringAllNotebooks] = useState(false)

  useEffect(() => {
    fetch('/api/sample-templates/hidden')
      .then(r => r.json())
      .then((data: { hidden: string[] }) => setHiddenSamplesCount(data.hidden.length))
      .catch((err) => {
        console.error('[load-hidden-samples]', err instanceof Error ? err.message : String(err))
        setHiddenSamplesCount(0)
      })
    fetch('/api/builtin-notebooks/hidden')
      .then(r => r.json())
      .then((data: { hidden: string[] }) => setHiddenNotebooksCount(data.hidden.length))
      .catch((err) => {
        console.error('[load-hidden-notebooks]', err instanceof Error ? err.message : String(err))
        setHiddenNotebooksCount(0)
      })
  }, [])

  async function handleRestoreAllSamples() {
    setRestoringAllSamples(true)
    try {
      const res = await fetch('/api/sample-templates/restore-all', { method: 'POST' })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json() as { restored: number }
      setHiddenSamplesCount(0)
      onStatus(`Restored ${data.restored} sample template(s).`)
      onRefreshRegistry?.()
    } catch (e) {
      onError(`Failed to restore samples: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRestoringAllSamples(false)
    }
  }

  async function handleRestoreAllNotebooks() {
    setRestoringAllNotebooks(true)
    try {
      const res = await fetch('/api/builtin-notebooks/restore-all', { method: 'POST' })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setHiddenNotebooksCount(0)
      onStatus('Restored all hidden system notebooks.')
    } catch (e) {
      onError(`Failed to restore notebooks: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRestoringAllNotebooks(false)
    }
  }

  async function handleImportOfficial(files: FileList) {
    setImporting(true)
    try {
      const fileEntries = await Promise.all(
        Array.from(files).map(async f => ({ name: f.name, content: await f.text() })),
      )
      const res = await fetch('/api/save-official-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileEntries }),
      })
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = (await res.json()) as { error?: string } } catch { /* non-JSON */ }
        onError(`Import failed: ${body.error ?? res.status}`)
        setImporting(false)
        return
      }
      window.location.reload()
    } catch (e) {
      onError(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
      setImporting(false)
    }
  }

  async function handleExportForDevice() {
    try {
      const res = await fetch('/api/export-templates')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = (await res.json()) as { error?: string } } catch { /* non-JSON */ }
        onError(`Export failed: ${body.error ?? res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'remarkable-templates.zip'
      a.click()
      URL.revokeObjectURL(url)
      onStatus('Export downloaded successfully.')
    } catch (e) {
      onError(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleExportRmMethods() {
    try {
      const res = await fetch('/api/export-rm-methods')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = (await res.json()) as { error?: string } } catch { /* non-JSON */ }
        onError(`rm_methods export failed: ${body.error ?? res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'remarkable-rm-methods.zip'
      a.click()
      URL.revokeObjectURL(url)
      onStatus('rm_methods export downloaded successfully.')
    } catch (e) {
      onError(`rm_methods export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <section className="device-card">
      <h2 className="device-card-title">Import &amp; Export</h2>
      <div className="device-card-body">
        <div className="device-op-section">
          <h3 className="device-op-section-title">Import Classic Templates</h3>
          <p className="device-card-desc">
            Import <code>.template</code> files from your computer. These are single-file classic templates.
            On the device, they're stored at <code>/usr/share/remarkable/templates/</code> alongside <code>templates.json</code>.
          </p>
          <button
            className="device-form-help-toggle"
            onClick={() => setShowImportHelp(!showImportHelp)}
            style={{ marginBottom: 8 }}
          >
            {showImportHelp ? 'Hide details' : 'What are classic templates?'}
          </button>
          {showImportHelp && (
            <div className="device-form-help" style={{ marginBottom: 12 }}>
              <p>Classic templates are single <code>.template</code> files registered in <code>templates.json</code> on the device's system partition.</p>
              <p>They do not sync across devices and are wiped during firmware updates.</p>
              <p>For templates that sync across paired devices, use <strong>Deploy via rm_methods</strong> in the Sync card instead.</p>
            </div>
          )}
          <p className="device-card-status">
            Status: {officialTemplatesAvailable === true ? 'Loaded' : officialTemplatesAvailable === false ? 'Not loaded' : 'Checking...'}
          </p>
          <button
            className="device-card-btn"
            onClick={() => officialInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Select Template Folder'}
          </button>
          <input
            ref={officialInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is not in standard typings
            webkitdirectory=""
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files) handleImportOfficial(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        <div className="device-op-section">
          <h3 className="device-op-section-title">Export Templates</h3>
          <div className="device-card-btn-row">
            <div>
              <button
                className="device-card-btn"
                onClick={handleExportForDevice}
                disabled={officialTemplatesAvailable !== true}
              >
                Download ZIP
              </button>
              <p className="device-card-hint">
                Classic format — single-file templates with merged <code>templates.json</code>.
                Transfer to <code>/usr/share/remarkable/templates/</code> via USB or use Deploy Classic.
              </p>
            </div>
            <div>
              <button
                className="device-card-btn device-card-btn-secondary"
                onClick={handleExportRmMethods}
              >
                Download rm_methods ZIP
              </button>
              <p className="device-card-hint">
                Methods format — multi-file templates with metadata for cloud sync across paired devices.
              </p>
            </div>
          </div>
          {officialTemplatesAvailable !== true && (
            <p className="device-card-hint">Import classic templates first to enable ZIP export.</p>
          )}
        </div>

        <div className="device-op-section">
          <h3 className="device-op-section-title">System Templates &amp; Notebooks</h3>
          <p className="device-card-desc">
            Built-in sample and debug templates and notebooks showcase the format's features.
            Hidden items can be restored here.
          </p>

          <h4 className="device-op-subsection-title">Templates</h4>
          {hiddenSamplesCount === null ? (
            <p className="device-card-hint">Loading...</p>
          ) : hiddenSamplesCount === 0 ? (
            <p className="device-card-hint">All system templates are visible.</p>
          ) : (
            <>
              <p className="device-card-hint">
                {hiddenSamplesCount} system template{hiddenSamplesCount !== 1 ? 's' : ''} hidden.
              </p>
              <button
                className="device-card-btn"
                onClick={handleRestoreAllSamples}
                disabled={restoringAllSamples}
              >
                {restoringAllSamples ? 'Restoring...' : 'Restore All Templates'}
              </button>
            </>
          )}

          <h4 className="device-op-subsection-title">Notebooks</h4>
          {hiddenNotebooksCount === null ? (
            <p className="device-card-hint">Loading...</p>
          ) : hiddenNotebooksCount === 0 ? (
            <p className="device-card-hint">All system notebooks are visible.</p>
          ) : (
            <>
              <p className="device-card-hint">
                {hiddenNotebooksCount} system notebook{hiddenNotebooksCount !== 1 ? 's' : ''} hidden.
              </p>
              <button
                className="device-card-btn"
                onClick={handleRestoreAllNotebooks}
                disabled={restoringAllNotebooks}
              >
                {restoringAllNotebooks ? 'Restoring...' : 'Restore All Notebooks'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
