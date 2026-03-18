import { useState, useRef } from 'react'

interface Props {
  officialTemplatesAvailable: boolean | null
  onStatus: (msg: string) => void
  onError: (msg: string) => void
}

export function DeviceImportExportCard({ officialTemplatesAvailable, onStatus, onError }: Props) {
  const [importing, setImporting] = useState(false)
  const officialInputRef = useRef<HTMLInputElement>(null)

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
          <h3 className="device-op-section-title">Official Templates (USB)</h3>
          <p className="device-card-desc">
            Import the official <code>.template</code> files from your reMarkable device.
            Connect via USB and select the templates folder.
          </p>
          <p className="device-card-status">
            Status: {officialTemplatesAvailable === true ? 'Loaded' : officialTemplatesAvailable === false ? 'Not loaded' : 'Checking...'}
          </p>
          <button
            className="device-card-btn"
            onClick={() => officialInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import from USB'}
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
          <h3 className="device-op-section-title">Export for Device</h3>
          <p className="device-card-desc">
            Download a merged ZIP of official + custom templates with an updated registry.
            Copy contents to your device via USB.
          </p>
          <div className="device-card-btn-row">
            <button
              className="device-card-btn"
              onClick={handleExportForDevice}
              disabled={officialTemplatesAvailable !== true}
            >
              Download ZIP
            </button>
            <button
              className="device-card-btn device-card-btn-secondary"
              onClick={handleExportRmMethods}
            >
              Download rm_methods ZIP
            </button>
          </div>
          {officialTemplatesAvailable !== true && (
            <p className="device-card-hint">Import official templates first to enable ZIP export.</p>
          )}
        </div>
      </div>
    </section>
  )
}
