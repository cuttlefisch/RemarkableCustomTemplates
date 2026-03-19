import { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  deviceId: string | null
  deviceName: string
  configured: boolean
  onStatus: (msg: string) => void
  onError: (msg: string) => void
  refreshKey?: number
}

interface AppBackupEntry {
  filename: string
  created: string
  size: number
}

interface DeviceBackupEntry {
  name: string
  created: string
  templateCount: number
}

interface RestorePreview {
  mergeAdded: string[]
  mergeSkipped: string[]
  wouldRemove: Array<{ name: string; filename: string; collection: 'custom' | 'debug' }>
  incomingCount: number
  warnings: string[]
}

type RestoreResult = {
  type: 'success'
  added: string[]
  skipped: string[]
  removed: string[]
} | {
  type: 'error'
  message: string
  details?: string[]
}

export function DeviceBackupsCard({ deviceId, deviceName, configured, onStatus: _onStatus, onError: _onError, refreshKey }: Props) {
  const [restoring, setRestoring] = useState(false)
  const [restoringServer, setRestoringServer] = useState<string | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [deviceBackups, setDeviceBackups] = useState<DeviceBackupEntry[]>([])
  const [appBackups, setAppBackups] = useState<AppBackupEntry[]>([])
  const [loadingDeviceBackups, setLoadingDeviceBackups] = useState(false)
  const [loadingAppBackups, setLoadingAppBackups] = useState(false)

  // Inline feedback state
  const [inlineStatus, setInlineStatus] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)

  // Restore preview / cleanup state
  const [preview, setPreview] = useState<RestorePreview | null>(null)
  const [previewZipBody, setPreviewZipBody] = useState<ArrayBuffer | null>(null)
  const [previewSource, setPreviewSource] = useState<string | null>(null) // filename for server restores, 'upload' for file uploads
  const [cleanupSelection, setCleanupSelection] = useState<Set<string>>(new Set())
  const [cleaningUp, setCleaningUp] = useState(false)

  function clearFeedback() {
    setInlineStatus(null)
    setInlineError(null)
    setRestoreResult(null)
  }

  const loadAppBackups = useCallback(async () => {
    setLoadingAppBackups(true)
    try {
      const r = await fetch('/api/backups')
      const data = (await r.json()) as { backups: AppBackupEntry[] }
      setAppBackups(data.backups)
    } catch {
      // ignore
    } finally {
      setLoadingAppBackups(false)
    }
  }, [])

  useEffect(() => {
    loadAppBackups()
  }, [loadAppBackups, refreshKey])

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    setLoadingDeviceBackups(true)

    async function load() {
      try {
        if (!deviceId) return
        const r = await fetch(`/api/devices/${deviceId}/backups`)
        const data = (await r.json()) as { backups: DeviceBackupEntry[] }
        if (!cancelled) setDeviceBackups(data.backups)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingDeviceBackups(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [configured, deviceId, refreshKey])

  async function handleBackup() {
    clearFeedback()
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = (await res.json()) as { error?: string } } catch { /* non-JSON */ }
        setInlineError(`Backup failed: ${body.error ?? res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
      a.download = `remarkable-backup-${dateStr}_${timeStr}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setInlineStatus('Backup downloaded successfully.')
      loadAppBackups()
    } catch (e) {
      setInlineError(`Backup failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Preview step: upload or read from server, then show what will happen
  async function fetchPreview(body: ArrayBuffer, source: string) {
    clearFeedback()
    setRestoring(true)
    try {
      const res = await fetch('/api/restore/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body,
      })
      const result = (await res.json()) as RestorePreview & { error?: string; details?: string[] }
      if (!res.ok) {
        const details = result.details ? `\n${result.details.join('\n')}` : ''
        setInlineError(`Invalid backup: ${result.error ?? res.status}${details}`)
        setRestoring(false)
        return
      }
      setPreview(result)
      setPreviewZipBody(body)
      setPreviewSource(source)
      // Default: select all removable items for cleanup
      setCleanupSelection(new Set(result.wouldRemove.map(r => r.filename)))
      setRestoring(false)
    } catch (e) {
      setInlineError(`Preview failed: ${e instanceof Error ? e.message : String(e)}`)
      setRestoring(false)
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const body = await file.arrayBuffer()
    await fetchPreview(body, 'upload')
  }

  async function handleRestoreFromServerPreview(filename: string) {
    clearFeedback()
    setRestoringServer(filename)
    try {
      const backupRes = await fetch(`/api/backups/${encodeURIComponent(filename)}/download`)
      if (!backupRes.ok) {
        setInlineError(`Failed to load backup: ${backupRes.status}`)
        setRestoringServer(null)
        return
      }
      const body = await backupRes.arrayBuffer()
      await fetchPreview(body, filename)
    } catch (e) {
      setInlineError(`Failed to load backup: ${e instanceof Error ? e.message : String(e)}`)
    }
    setRestoringServer(null)
  }

  async function executeRestore() {
    if (!previewZipBody) return
    clearFeedback()
    setRestoring(true)
    try {
      const res = await fetch('/api/restore?mode=merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: previewZipBody,
      })
      const result = (await res.json()) as {
        ok?: boolean
        error?: string
        details?: string[]
        added?: string[]
        skipped?: string[]
        removed?: string[]
      }
      if (!res.ok) {
        const details = result.details ? `\n${result.details.join('\n')}` : ''
        setRestoreResult({ type: 'error', message: `Restore failed: ${result.error ?? res.status}${details}` })
        setRestoring(false)
        return
      }

      // Now handle cleanup of selected templates
      const selectedCleanup = preview?.wouldRemove.filter(r => cleanupSelection.has(r.filename)) ?? []
      let cleanupRemoved: string[] = []

      if (selectedCleanup.length > 0) {
        setCleaningUp(true)
        try {
          const cleanupRes = await fetch('/api/restore/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templates: selectedCleanup }),
          })
          const cleanupResult = (await cleanupRes.json()) as { ok?: boolean; removed?: string[] }
          if (cleanupResult.ok) {
            cleanupRemoved = cleanupResult.removed ?? []
          }
        } catch {
          // cleanup is best-effort
        }
        setCleaningUp(false)
      }

      setRestoreResult({
        type: 'success',
        added: result.added ?? [],
        skipped: result.skipped ?? [],
        removed: cleanupRemoved,
      })

      // Clear preview state
      setPreview(null)
      setPreviewZipBody(null)
      setPreviewSource(null)
      setRestoring(false)

      // Reload if anything changed
      if ((result.added?.length ?? 0) > 0 || cleanupRemoved.length > 0) {
        // Delay reload briefly so user sees the result
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (e) {
      setRestoreResult({ type: 'error', message: `Restore failed: ${e instanceof Error ? e.message : String(e)}` })
      setRestoring(false)
    }
  }

  function cancelPreview() {
    setPreview(null)
    setPreviewZipBody(null)
    setPreviewSource(null)
    setCleanupSelection(new Set())
  }

  function toggleCleanupItem(filename: string) {
    setCleanupSelection(prev => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  function selectAllCleanup() {
    setCleanupSelection(new Set(preview?.wouldRemove.map(r => r.filename) ?? []))
  }

  function deselectAllCleanup() {
    setCleanupSelection(new Set())
  }

  async function handleDeleteBackup(filename: string) {
    clearFeedback()
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = (await res.json()) as { error?: string } } catch { /* non-JSON */ }
        setInlineError(`Delete failed: ${body.error ?? res.status}`)
        return
      }
      setAppBackups(prev => prev.filter(b => b.filename !== filename))
      setInlineStatus('Backup deleted.')
    } catch (e) {
      setInlineError(`Delete failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function formatBackupFilename(filename: string) {
    const match = filename.match(/remarkable-backup-(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})\.zip/)
    if (!match) return filename
    return `${match[1]} ${match[2]}:${match[3]}:${match[4]}`
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDeviceBackupName(name: string) {
    const match = name.match(/rm-methods_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
    if (!match) return name
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`
  }

  return (
    <section className="device-card">
      <h2 className="device-card-title">Backups</h2>
      <div className="device-card-body">
        <div className="device-op-section">
          <h3 className="device-op-section-title">App Backups</h3>
          <p className="device-card-desc">
            Download a backup of all custom and debug templates, registries, deployment manifests, and rm-methods build files.
            Restoring a backup merges new templates and restores deploy state so you can redeploy with the same UUIDs.
          </p>

          {/* Inline feedback */}
          {inlineStatus && (
            <div className="backup-inline-status">
              {inlineStatus}
              <button className="backup-inline-dismiss" onClick={() => setInlineStatus(null)}>&times;</button>
            </div>
          )}
          {inlineError && (
            <div className="backup-inline-error">
              {inlineError}
              <button className="backup-inline-dismiss" onClick={() => setInlineError(null)}>&times;</button>
            </div>
          )}

          {/* Restore result feedback */}
          {restoreResult && restoreResult.type === 'success' && (
            <div className="backup-inline-status">
              <strong>Restore complete.</strong>
              {restoreResult.added.length > 0 && (
                <span> {restoreResult.added.length} template{restoreResult.added.length !== 1 ? 's' : ''} added.</span>
              )}
              {restoreResult.skipped.length > 0 && (
                <span> {restoreResult.skipped.length} skipped (already present).</span>
              )}
              {restoreResult.removed.length > 0 && (
                <span> {restoreResult.removed.length} removed.</span>
              )}
              {restoreResult.added.length === 0 && restoreResult.removed.length === 0 && (
                <span> No changes — all templates already present.</span>
              )}
              {(restoreResult.added.length > 0 || restoreResult.removed.length > 0) && (
                <span className="backup-reload-hint"> Reloading...</span>
              )}
            </div>
          )}
          {restoreResult && restoreResult.type === 'error' && (
            <div className="backup-inline-error">
              {restoreResult.message}
              <button className="backup-inline-dismiss" onClick={() => setRestoreResult(null)}>&times;</button>
            </div>
          )}

          {/* Restore preview panel */}
          {preview && (
            <div className="backup-preview-panel">
              <h4 className="backup-preview-title">Restore Preview</h4>
              {previewSource && previewSource !== 'upload' && (
                <p className="backup-preview-source">From: {formatBackupFilename(previewSource)}</p>
              )}

              <div className="backup-preview-summary">
                <span className="backup-preview-stat backup-preview-incoming">{preview.incomingCount} template{preview.incomingCount !== 1 ? 's' : ''} in backup</span>
                {preview.mergeAdded.length > 0 && (
                  <span className="backup-preview-stat backup-preview-add">{preview.mergeAdded.length} will be added</span>
                )}
                {preview.mergeSkipped.length > 0 && (
                  <span className="backup-preview-stat backup-preview-skip">{preview.mergeSkipped.length} already present</span>
                )}
              </div>

              {preview.wouldRemove.length > 0 && (
                <div className="backup-cleanup-section">
                  <div className="backup-cleanup-header">
                    <h5 className="backup-cleanup-title">
                      Local templates not in backup ({preview.wouldRemove.length})
                    </h5>
                    <div className="backup-cleanup-actions">
                      <button className="backup-cleanup-toggle" onClick={selectAllCleanup}>Select all</button>
                      <button className="backup-cleanup-toggle" onClick={deselectAllCleanup}>Deselect all</button>
                    </div>
                  </div>
                  <p className="backup-cleanup-warning">
                    Checked templates will be permanently deleted after restore.
                  </p>
                  <div className="backup-cleanup-list">
                    {preview.wouldRemove.map(item => (
                      <label key={item.filename} className="backup-cleanup-item">
                        <input
                          type="checkbox"
                          checked={cleanupSelection.has(item.filename)}
                          onChange={() => toggleCleanupItem(item.filename)}
                        />
                        <span className="backup-cleanup-item-name">{item.name}</span>
                        <span className="backup-cleanup-item-collection">{item.collection}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {preview.warnings.length > 0 && (
                <div className="backup-preview-warnings">
                  {preview.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              <div className="backup-preview-btn-row">
                <button
                  className="device-card-btn"
                  onClick={executeRestore}
                  disabled={restoring || cleaningUp}
                >
                  {restoring || cleaningUp
                    ? 'Restoring...'
                    : cleanupSelection.size > 0
                      ? `Restore & Remove ${cleanupSelection.size} Template${cleanupSelection.size !== 1 ? 's' : ''}`
                      : 'Restore (merge only)'}
                </button>
                <button className="device-card-btn device-card-btn-secondary" onClick={cancelPreview}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons (hidden during preview) */}
          {!preview && (
            <>
              <div className="device-card-btn-row">
                <button className="device-card-btn" onClick={handleBackup}>
                  Download Backup
                </button>
                <button
                  className="device-card-btn device-card-btn-secondary"
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={restoring}
                >
                  {restoring ? 'Loading...' : 'Restore from ZIP'}
                </button>
              </div>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={handleRestoreFile}
              />

              {loadingAppBackups ? (
                <p className="device-card-hint">Loading backups...</p>
              ) : appBackups.length > 0 && (
                <div className="device-backup-list">
                  <div className="device-backup-list-header">Previous backups</div>
                  {appBackups.map(b => (
                    <div key={b.filename} className="device-backup-entry">
                      <div className="device-backup-info">
                        <span className="device-backup-name">{formatBackupFilename(b.filename)}</span>
                        <span className="device-backup-size">{formatSize(b.size)}</span>
                      </div>
                      <div className="device-backup-actions">
                        <button
                          className="device-backup-action-btn"
                          onClick={() => handleRestoreFromServerPreview(b.filename)}
                          disabled={restoringServer !== null}
                          title="Restore from this backup"
                        >
                          {restoringServer === b.filename ? 'Loading...' : 'Restore'}
                        </button>
                        <button
                          className="device-backup-action-btn device-backup-delete-btn"
                          onClick={() => handleDeleteBackup(b.filename)}
                          title="Delete this backup"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="device-op-section">
          <h3 className="device-op-section-title">{deviceName} Deploy Backups</h3>
          {!configured ? (
            <p className="device-card-hint">Connect to a device to view deploy backups.</p>
          ) : loadingDeviceBackups ? (
            <p className="device-card-hint">Loading...</p>
          ) : deviceBackups.length === 0 ? (
            <p className="device-backup-empty">No deploy backups yet. Deploy templates to create your first backup.</p>
          ) : (
            <div className="device-backup-list">
              {deviceBackups.map(b => (
                <div key={b.name} className="device-backup-entry">
                  <span className="device-backup-name">{formatDeviceBackupName(b.name)}</span>
                  <span className="device-backup-count">{b.templateCount} templates</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
