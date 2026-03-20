import { useState, useRef, useEffect } from 'react'

interface Props {
  officialTemplatesAvailable: boolean | null
  onStatus: (msg: string) => void
  onError: (msg: string) => void
  onRefreshRegistry?: () => void
}

export function DeviceImportExportCard({ officialTemplatesAvailable, onStatus, onError, onRefreshRegistry }: Props) {
  const [importing, setImporting] = useState(false)
  const [showImportHelp, setShowImportHelp] = useState(false)
  const officialInputRef = useRef<HTMLInputElement>(null)
  const [hiddenSamplesCount, setHiddenSamplesCount] = useState<number | null>(null)
  const [restoringAllSamples, setRestoringAllSamples] = useState(false)

  useEffect(() => {
    fetch('/api/sample-templates/hidden')
      .then(r => r.json())
      .then((data: { hidden: string[] }) => setHiddenSamplesCount(data.hidden.length))
      .catch(() => setHiddenSamplesCount(0))
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
          <h3 className="device-op-section-title">Sample Templates</h3>
          <p className="device-card-desc">
            Sample templates showcase the template format's features. Hidden samples can be restored here.
          </p>
          {hiddenSamplesCount === null ? (
            <p className="device-card-hint">Loading...</p>
          ) : hiddenSamplesCount === 0 ? (
            <p className="device-card-hint">All sample templates are visible.</p>
          ) : (
            <>
              <p className="device-card-hint">
                {hiddenSamplesCount} sample template{hiddenSamplesCount !== 1 ? 's' : ''} hidden.
              </p>
              <button
                className="device-card-btn"
                onClick={handleRestoreAllSamples}
                disabled={restoringAllSamples}
              >
                {restoringAllSamples ? 'Restoring...' : 'Restore All Samples'}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
