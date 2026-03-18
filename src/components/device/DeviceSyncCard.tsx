import { useState } from 'react'

interface Props {
  configured: boolean
  onSyncComplete?: () => void
}

type OpResult = { ok: true; message: string; steps?: string[] } | { ok: false; error: string; hint?: string }

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

export function DeviceSyncCard({ configured, onSyncComplete }: Props) {
  const [showHelp, setShowHelp] = useState(false)
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
          </>
        )}
      </div>
    </section>
  )
}
