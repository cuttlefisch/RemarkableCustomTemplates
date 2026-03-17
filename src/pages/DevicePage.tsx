import { useState, useRef } from 'react'
import { useRegistryContext } from '../hooks/useRegistry'
import './DevicePage.css'

export function DevicePage() {
  const { officialTemplatesAvailable } = useRegistryContext()

  const [importing, setImporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const officialInputRef = useRef<HTMLInputElement>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  function setStatus(msg: string) { setStatusMessage(msg); setErrorMessage(null) }
  function setError(msg: string) { setErrorMessage(msg); setStatusMessage(null) }
  function clearMessages() { setStatusMessage(null); setErrorMessage(null) }

  async function handleImportOfficial(files: FileList) {
    setImporting(true)
    clearMessages()
    try {
      const fileEntries = await Promise.all(
        Array.from(files).map(async f => ({ name: f.name, content: await f.text() }))
      )
      const res = await fetch('/api/save-official-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileEntries }),
      })
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = await res.json() as { error?: string } } catch { /* non-JSON response */ }
        setError(`Import failed: ${body.error ?? res.status}`)
        setImporting(false)
        return
      }
      window.location.reload()
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
      setImporting(false)
    }
  }

  async function handleExportForDevice() {
    clearMessages()
    try {
      const res = await fetch('/api/export-templates')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = await res.json() as { error?: string } } catch { /* non-JSON response */ }
        setError(`Export failed: ${body.error ?? res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'remarkable-templates.zip'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('Export downloaded successfully.')
    } catch (e) {
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleExportRmMethods() {
    clearMessages()
    try {
      const res = await fetch('/api/export-rm-methods')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = await res.json() as { error?: string } } catch { /* non-JSON response */ }
        setError(`rm_methods export failed: ${body.error ?? res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'remarkable-rm-methods.zip'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('rm_methods export downloaded successfully.')
    } catch (e) {
      setError(`rm_methods export failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleBackup() {
    clearMessages()
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = await res.json() as { error?: string } } catch { /* non-JSON response */ }
        setError(`Backup failed: ${body.error ?? res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `remarkable-backup-${dateStr}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('Backup downloaded successfully.')
    } catch (e) {
      setError(`Backup failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setRestoring(true)
    clearMessages()

    try {
      const body = await file.arrayBuffer()
      const res = await fetch('/api/restore?mode=merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body,
      })
      const result = await res.json() as { ok?: boolean; error?: string; details?: string[]; added?: string[]; skipped?: string[]; warnings?: string[] }
      if (!res.ok) {
        const details = result.details ? `\n${result.details.join('\n')}` : ''
        setError(`Restore failed: ${result.error ?? res.status}${details}`)
        setRestoring(false)
        return
      }
      const addedCount = result.added?.length ?? 0
      const skippedCount = result.skipped?.length ?? 0
      setRestoring(false)
      if (addedCount > 0) {
        window.location.reload()
      } else {
        setStatus(`Restore complete: ${addedCount} added, ${skippedCount} skipped (all templates already present)`)
      }
    } catch (e) {
      setError(`Restore failed: ${e instanceof Error ? e.message : String(e)}`)
      setRestoring(false)
    }
  }

  return (
    <div className="device-page">
      <div className="device-page-inner">
        <h1 className="device-page-title">Device &amp; Sync</h1>
        <p className="device-page-subtitle">
          Import official templates, export to your device, and manage backups.
        </p>

        {statusMessage && <div className="device-status">{statusMessage}</div>}
        {errorMessage && <div className="device-error">{errorMessage}</div>}

        {/* ── Getting Started ── */}
        <section className="device-card">
          <h2 className="device-card-title">Getting Started</h2>
          <div className="device-card-body">
            <ol className="device-steps">
              <li><strong>Import official templates</strong> from your reMarkable device using the card below.</li>
              <li><strong>Create or edit templates</strong> on the Templates page.</li>
              <li><strong>Export</strong> your templates back to your device using one of the export options.</li>
            </ol>
          </div>
        </section>

        {/* ── Official Templates ── */}
        <section className="device-card">
          <h2 className="device-card-title">Official Templates</h2>
          <div className="device-card-body">
            <p className="device-card-desc">
              Import the official <code>.template</code> files from your reMarkable device.
              Connect your device via USB, then select the templates folder.
            </p>
            <p className="device-card-status">
              Status: {officialTemplatesAvailable === true ? 'Loaded' : officialTemplatesAvailable === false ? 'Not loaded' : 'Checking...'}
            </p>
            <button
              className="device-card-btn"
              onClick={() => officialInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Import from device'}
            </button>
            <input
              ref={officialInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is not in standard typings
              webkitdirectory=""
              multiple
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files) handleImportOfficial(e.target.files); e.target.value = '' }}
            />
          </div>
        </section>

        {/* ── Export for Device ── */}
        <section className="device-card">
          <h2 className="device-card-title">Export for Device</h2>
          <div className="device-card-body">
            <p className="device-card-desc">
              Download a merged ZIP of official + custom templates with an updated <code>templates.json</code> registry.
              Copy the contents to your device via USB.
            </p>
            <button
              className="device-card-btn"
              onClick={handleExportForDevice}
              disabled={officialTemplatesAvailable !== true}
            >
              Download ZIP
            </button>
            {officialTemplatesAvailable !== true && (
              <p className="device-card-hint">Import official templates first to enable this option.</p>
            )}
          </div>
        </section>

        {/* ── Export rm_methods ── */}
        <section className="device-card">
          <h2 className="device-card-title">Export rm_methods</h2>
          <div className="device-card-body">
            <p className="device-card-desc">
              Export custom templates in rm_methods format for firmware 3.17+.
              This format syncs across paired devices via the reMarkable cloud.
            </p>
            <button
              className="device-card-btn"
              onClick={handleExportRmMethods}
            >
              Download rm_methods ZIP
            </button>
          </div>
        </section>

        {/* ── Backup & Restore ── */}
        <section className="device-card">
          <h2 className="device-card-title">Backup &amp; Restore</h2>
          <div className="device-card-body">
            <p className="device-card-desc">
              Download a backup of all custom and debug templates, or restore from a previous backup ZIP (merge mode — existing templates are kept).
            </p>
            <div className="device-card-btn-row">
              <button className="device-card-btn" onClick={handleBackup}>
                Download Backup
              </button>
              <button
                className="device-card-btn device-card-btn-secondary"
                onClick={() => restoreInputRef.current?.click()}
                disabled={restoring}
              >
                {restoring ? 'Restoring...' : 'Restore from ZIP'}
              </button>
            </div>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".zip"
              style={{ display: 'none' }}
              onChange={handleRestoreFile}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
