import { useState, useCallback } from 'react'

interface Props {
  configured: boolean
  onSyncComplete?: () => void
}

type OpResult = { ok: true; message: string; steps?: string[] } | { ok: false; error: string; hint?: string }

// ---------------------------------------------------------------------------
// Sync status types & hook
// ---------------------------------------------------------------------------

type SyncState = 'synced' | 'local-only' | 'device-only' | 'modified'

interface TemplateSyncEntry {
  uuid: string
  name: string
  state: SyncState
  localVersion?: string
  deviceVersion?: string
}

interface SyncStatusSummary {
  synced: number
  localOnly: number
  deviceOnly: number
  modified: number
  total: number
}

interface SyncStatusResponse {
  summary: SyncStatusSummary
  templates: TemplateSyncEntry[]
  checkedAt: string
}

function useSyncStatus() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<SyncStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/device/sync-status', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error: string }).error ?? `HTTP ${res.status}`)
        setStatus(null)
      } else {
        setStatus(data as SyncStatusResponse)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setStatus(null)
    setError(null)
  }, [])

  return { loading, status, error, check, clear }
}

type RemoveAllPhase = 'idle' | 'loading-preview' | 'preview' | 'executing' | 'done' | 'error'
interface RemoveAllPreview { count: number; templates: { uuid: string; name: string }[]; error?: string }
interface RemoveAllResult { ok: boolean; steps?: string[]; backupFilename?: string; error?: string; hint?: string }

function useDeviceOp(url: string, options?: { confirmMsg?: string; onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OpResult | null>(null)

  async function run() {
    if (options?.confirmMsg && !window.confirm(options.confirmMsg)) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(url, { method: 'POST' })
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        const hint = data.hint as string | undefined
        setResult({ ok: false, error: (data.error as string) ?? `HTTP ${res.status}`, hint })
      } else {
        const steps = data.steps as string[] | undefined
        const count = data.count as number | undefined
        const message = data.message as string | undefined
        const restoredFrom = data.restoredFrom as string | undefined
        const msg =
          message ??
          ((steps ? steps.join(' \u2192 ') : '') ||
          (count !== undefined ? `Pulled ${count} templates` : '') ||
          (restoredFrom ? `Restored from ${restoredFrom}` : 'Done'))
        setResult({ ok: true, message: msg, steps })
        options?.onSuccess?.()
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return { loading, result, run }
}

function OpButton({
  label,
  loadingLabel,
  op,
  variant = 'primary',
  disabled = false,
  title,
}: {
  label: string
  loadingLabel: string
  op: ReturnType<typeof useDeviceOp>
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  title?: string
}) {
  const cls =
    variant === 'danger'
      ? 'device-card-btn device-card-btn-danger'
      : variant === 'secondary'
        ? 'device-card-btn device-card-btn-secondary'
        : 'device-card-btn'
  return (
    <div>
      <button className={cls} onClick={op.run} disabled={op.loading || disabled} title={title}>
        {op.loading ? loadingLabel : label}
      </button>
      {op.result && (
        <div className={`device-op-result ${op.result.ok ? '' : 'error'}`}>
          <p style={{ margin: 0 }}>{op.result.ok ? op.result.message : op.result.error}</p>
          {!op.result.ok && op.result.hint && (
            <p className="device-error-hint">{op.result.hint}</p>
          )}
        </div>
      )}
    </div>
  )
}

function useRemoveAll() {
  const [phase, setPhase] = useState<RemoveAllPhase>('idle')
  const [preview, setPreview] = useState<RemoveAllPreview | null>(null)
  const [result, setResult] = useState<RemoveAllResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const loadPreview = useCallback(async () => {
    setPhase('loading-preview')
    setErrorMsg('')
    try {
      const res = await fetch('/api/device/remove-all-preview', { method: 'POST' })
      const data = await res.json() as RemoveAllPreview & { hint?: string }
      if (!res.ok) {
        setErrorMsg((data as unknown as { error: string }).error ?? `HTTP ${res.status}`)
        setPhase('error')
        return
      }
      if (data.count === 0 && data.error) {
        setErrorMsg(data.error)
        setPhase('error')
        return
      }
      setPreview(data)
      setPhase('preview')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }, [])

  const execute = useCallback(async () => {
    setPhase('executing')
    setErrorMsg('')
    try {
      const res = await fetch('/api/device/remove-all-execute', { method: 'POST' })
      const data = await res.json() as RemoveAllResult
      if (!res.ok) {
        setErrorMsg(data.error ?? `HTTP ${res.status}`)
        setPhase('error')
        return
      }
      setResult(data)
      setPhase('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setPreview(null)
    setResult(null)
    setErrorMsg('')
  }, [])

  return { phase, preview, result, errorMsg, loadPreview, execute, reset }
}

const SYNC_BADGE_LABELS: Record<SyncState, string> = {
  synced: 'Synced',
  'local-only': 'Local Only',
  modified: 'Modified',
  'device-only': 'Device Only',
}

function SyncBadge({ state }: { state: SyncState }) {
  return <span className={`sync-badge sync-badge-${state}`}>{SYNC_BADGE_LABELS[state]}</span>
}

function SyncStatusSection({ syncStatus }: { syncStatus: ReturnType<typeof useSyncStatus> }) {
  const { loading, status, error, check } = syncStatus

  const allSynced = status && status.summary.total > 0 && status.summary.synced === status.summary.total

  return (
    <div className="device-op-section">
      <h3 className="device-op-section-title">Sync Status</h3>
      <p className="device-op-desc">Compare your local templates against what's deployed on the device.</p>

      <button
        className="device-card-btn"
        onClick={check}
        disabled={loading}
      >
        {loading ? 'Checking...' : status ? 'Refresh' : 'Check Sync Status'}
      </button>

      {error && (
        <div className="device-op-result error" style={{ marginTop: 8 }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {status && (
        <div style={{ marginTop: 12 }}>
          {allSynced ? (
            <div className="sync-status-all-synced">
              All {status.summary.total} templates are in sync with your device.
            </div>
          ) : (
            <div className="sync-status-summary">
              {status.summary.synced > 0 && <span className="sync-count-synced">{status.summary.synced} synced</span>}
              {status.summary.localOnly > 0 && <span className="sync-count-local-only">{status.summary.localOnly} needs deploy</span>}
              {status.summary.modified > 0 && <span className="sync-count-modified">{status.summary.modified} modified</span>}
              {status.summary.deviceOnly > 0 && <span className="sync-count-device-only">{status.summary.deviceOnly} device-only</span>}
            </div>
          )}

          {status.templates.length > 0 && (
            <div className="sync-status-list">
              {status.templates.map(t => (
                <div key={t.uuid} className="sync-status-entry">
                  <span className="sync-status-name">{t.name}</span>
                  <span className="sync-status-right">
                    <SyncBadge state={t.state} />
                    {t.state === 'modified' && t.localVersion && t.deviceVersion && (
                      <span className="sync-status-versions">
                        {t.deviceVersion} → {t.localVersion}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {status.summary.total === 0 && (
            <p className="device-card-hint" style={{ marginTop: 8 }}>No templates found locally or on the device.</p>
          )}

          <p className="device-card-hint">Checked {new Date(status.checkedAt).toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  )
}

export function DeviceSyncCard({ configured, onSyncComplete }: Props) {
  const [showHelp, setShowHelp] = useState(false)
  const syncStatus = useSyncStatus()
  const pullOfficial = useDeviceOp('/api/device/pull-official', { onSuccess: onSyncComplete })
  const pullMethods = useDeviceOp('/api/device/pull-methods', { onSuccess: onSyncComplete })
  const deployMethods = useDeviceOp('/api/device/deploy-methods')
  const deployClassic = useDeviceOp('/api/device/deploy-classic')
  const rollbackMethods = useDeviceOp(
    '/api/device/rollback-methods',
    { confirmMsg: 'Rollback to the most recent backup? This will restart the device UI.' },
  )
  const rollbackOriginal = useDeviceOp(
    '/api/device/rollback-original',
    { confirmMsg: 'Remove all custom templates from device? This will restart the device UI.' },
  )
  const rollbackClassic = useDeviceOp(
    '/api/device/rollback-classic',
    { confirmMsg: 'Restore from the latest classic backup on device? This will restart the device UI.' },
  )
  const removeAll = useRemoveAll()

  return (
    <section className="device-card">
      <h2 className="device-card-title">Sync</h2>
      <div className="device-card-body">
        {!configured ? (
          <p className="device-card-hint">Set up a device connection to enable sync operations.</p>
        ) : (
          <>
            <button
              className="device-form-help-toggle"
              onClick={() => setShowHelp(!showHelp)}
              style={{ marginBottom: 12 }}
            >
              {showHelp ? 'Hide' : 'How syncing works'}
            </button>
            {showHelp && (
              <div className="device-form-help" style={{ marginBottom: 16 }}>
                <p><strong>Pull</strong> downloads templates from your device into this app so you can browse and fork them.</p>
                <p><strong>Deploy via rm_methods</strong> (recommended) pushes multi-file templates to the device's user content directory. They sync across paired devices via the reMarkable cloud and survive firmware updates.</p>
                <p><strong>Deploy Classic</strong> pushes single-file templates to the system partition. These don't sync across devices and are wiped on firmware updates.</p>
                <p><strong>Rollback</strong> reverts your device to a previous deployment state. The device UI restarts during deploy and rollback.</p>
              </div>
            )}

            <SyncStatusSection syncStatus={syncStatus} />

            <div className="device-op-section">
              <h3 className="device-op-section-title">Pull from Device</h3>
              <p className="device-op-desc">Download templates from your device to browse or use as a starting point for custom templates.</p>
              <div className="device-card-btn-row">
                <OpButton
                  label="Pull Classic Templates"
                  loadingLabel="Pulling..."
                  op={pullOfficial}
                  title="Download classic templates from /usr/share/remarkable/templates/"
                />
                <OpButton
                  label="Pull Methods Templates"
                  loadingLabel="Pulling..."
                  op={pullMethods}
                  variant="secondary"
                  title="Download methods templates (official + custom) from the device"
                />
              </div>
            </div>

            <div className="device-op-section">
              <h3 className="device-op-section-title">Deploy to Device</h3>
              <p className="device-op-desc">Push your custom templates to the device. The device UI will restart.</p>
              <div className="device-card-btn-row">
                <OpButton
                  label="Deploy via rm_methods"
                  loadingLabel="Deploying..."
                  op={deployMethods}
                  title="Build and push templates in methods format — syncs across paired devices"
                />
                <OpButton
                  label="Deploy Classic"
                  loadingLabel="Deploying..."
                  op={deployClassic}
                  variant="secondary"
                  title="Push classic templates to /usr/share/remarkable/templates/ — single device only, wiped on firmware updates"
                />
              </div>
              <p className="device-card-hint">
                Classic deploys single-file templates to the system partition — no cloud sync, wiped on firmware updates. rm_methods is recommended.
              </p>
            </div>

            <div className="device-op-section">
              <h3 className="device-op-section-title">Rollback</h3>
              <p className="device-op-desc">Revert to a previous deployment if something goes wrong.</p>
              <div className="device-card-btn-row">
                <OpButton
                  label="Rollback to Previous"
                  loadingLabel="Rolling back..."
                  op={rollbackMethods}
                  variant="danger"
                  title="Revert to the state before your last rm_methods deploy"
                />
                <OpButton
                  label="Rollback to Original"
                  loadingLabel="Rolling back..."
                  op={rollbackOriginal}
                  variant="danger"
                  title="Remove all custom methods templates from the device"
                />
                <OpButton
                  label="Rollback Classic"
                  loadingLabel="Rolling back..."
                  op={rollbackClassic}
                  variant="danger"
                  title="Restore the most recent classic template backup on the device"
                />
              </div>
            </div>

            <div className="device-op-section">
              <h3 className="device-op-section-title" style={{ color: '#c62828' }}>Danger Zone</h3>
              <p className="device-op-desc">Remove all custom templates deployed via this app. Official reMarkable templates are preserved. A backup is created automatically before removal.</p>

              {removeAll.phase === 'idle' && (
                <button
                  className="device-card-btn device-card-btn-danger"
                  onClick={removeAll.loadPreview}
                >
                  Remove All Custom Templates from Device
                </button>
              )}

              {removeAll.phase === 'loading-preview' && (
                <button className="device-card-btn device-card-btn-danger" disabled>
                  Scanning device...
                </button>
              )}

              {removeAll.phase === 'preview' && removeAll.preview && (
                <div className="remove-all-preview">
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
                    {removeAll.preview.count} custom template{removeAll.preview.count !== 1 ? 's' : ''} will be removed:
                  </p>
                  <ul className="remove-all-list">
                    {removeAll.preview.templates.map(t => (
                      <li key={t.uuid}>{t.name}</li>
                    ))}
                  </ul>
                  <div className="device-card-btn-row" style={{ marginTop: 12 }}>
                    <button
                      className="device-card-btn device-card-btn-danger"
                      onClick={removeAll.execute}
                    >
                      Confirm &amp; Remove
                    </button>
                    <button
                      className="device-card-btn device-card-btn-secondary"
                      onClick={removeAll.reset}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {removeAll.phase === 'executing' && (
                <button className="device-card-btn device-card-btn-danger" disabled>
                  Removing templates...
                </button>
              )}

              {removeAll.phase === 'done' && removeAll.result && (
                <div className="device-op-result">
                  <p style={{ margin: 0 }}>All custom templates removed.</p>
                  {removeAll.result.steps && (
                    <ul className="device-op-steps" style={{ marginTop: 6 }}>
                      {removeAll.result.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                  {removeAll.result.backupFilename && (
                    <p style={{ margin: '8px 0 0', fontSize: 12 }}>
                      <a
                        href={`/api/device/remove-all-backup/${removeAll.result.backupFilename}`}
                        download
                      >
                        Download backup ZIP
                      </a>
                    </p>
                  )}
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={removeAll.reset}
                    style={{ marginTop: 8 }}
                  >
                    Done
                  </button>
                </div>
              )}

              {removeAll.phase === 'error' && (
                <div>
                  <div className="device-op-result error">
                    <p style={{ margin: 0 }}>{removeAll.errorMsg}</p>
                  </div>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={removeAll.reset}
                    style={{ marginTop: 8 }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
