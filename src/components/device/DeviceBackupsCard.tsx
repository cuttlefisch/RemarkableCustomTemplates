import { useState, useEffect, useRef } from 'react'

interface Props {
  configured: boolean
  onStatus: (msg: string) => void
  onError: (msg: string) => void
}

interface BackupEntry {
  name: string
  created: string
  templateCount: number
}

export function DeviceBackupsCard({ configured, onStatus, onError }: Props) {
  const [restoring, setRestoring] = useState(false)
  const restoreInputRef = useRef<HTMLInputElement>(null)
  const [deviceBackups, setDeviceBackups] = useState<BackupEntry[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    setLoadingBackups(true)

    async function load() {
      try {
        const r = await fetch('/api/device/backups')
        const data = (await r.json()) as { backups: BackupEntry[] }
        if (!cancelled) setDeviceBackups(data.backups)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingBackups(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [configured])

  async function handleBackup() {
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        let body: { error?: string } = {}
        try { body = (await res.json()) as { error?: string } } catch { /* non-JSON */ }
        onError(`Backup failed: ${body.error ?? res.status}`)
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
      onStatus('Backup downloaded successfully.')
    } catch (e) {
      onError(`Backup failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setRestoring(true)

    try {
      const body = await file.arrayBuffer()
      const res = await fetch('/api/restore?mode=merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body,
      })
      const result = (await res.json()) as {
        ok?: boolean
        error?: string
        details?: string[]
        added?: string[]
        skipped?: string[]
      }
      if (!res.ok) {
        const details = result.details ? `\n${result.details.join('\n')}` : ''
        onError(`Restore failed: ${result.error ?? res.status}${details}`)
        setRestoring(false)
        return
      }
      const addedCount = result.added?.length ?? 0
      const skippedCount = result.skipped?.length ?? 0
      setRestoring(false)
      if (addedCount > 0) {
        window.location.reload()
      } else {
        onStatus(`Restore complete: ${addedCount} added, ${skippedCount} skipped (all templates already present)`)
      }
    } catch (e) {
      onError(`Restore failed: ${e instanceof Error ? e.message : String(e)}`)
      setRestoring(false)
    }
  }

  function formatBackupName(name: string) {
    // rm-methods_20260317_143022 → 2026-03-17 14:30:22
    const match = name.match(/rm-methods_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
    if (!match) return name
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`
  }

  return (
    <section className="device-card">
      <h2 className="device-card-title">Backups</h2>
      <div className="device-card-body">
        <div className="device-op-section">
          <h3 className="device-op-section-title">Local Backups</h3>
          <p className="device-card-desc">
            Download a backup of all custom and debug templates, registries, and deployment manifests needed to restore your device to its current state. Restore from a previous backup ZIP to pick up where you left off.
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

        <div className="device-op-section">
          <h3 className="device-op-section-title">Device Backups</h3>
          {!configured ? (
            <p className="device-card-hint">Connect to your device to view device backups.</p>
          ) : loadingBackups ? (
            <p className="device-card-hint">Loading...</p>
          ) : deviceBackups.length === 0 ? (
            <p className="device-backup-empty">No device backups yet. Deploy templates to create your first backup.</p>
          ) : (
            <div className="device-backup-list">
              {deviceBackups.map(b => (
                <div key={b.name} className="device-backup-entry">
                  <span className="device-backup-name">{formatBackupName(b.name)}</span>
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
