import { useState } from 'react'

interface Props {
  configured: boolean
  onSyncComplete?: () => void
}

type OpResult = { ok: true; message: string; steps?: string[] } | { ok: false; error: string }

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
        setResult({ ok: false, error: (data.error as string) ?? `HTTP ${res.status}` })
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
}: {
  label: string
  loadingLabel: string
  op: ReturnType<typeof useDeviceOp>
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}) {
  const cls =
    variant === 'danger'
      ? 'device-card-btn device-card-btn-danger'
      : variant === 'secondary'
        ? 'device-card-btn device-card-btn-secondary'
        : 'device-card-btn'
  return (
    <div>
      <button className={cls} onClick={op.run} disabled={op.loading || disabled}>
        {op.loading ? loadingLabel : label}
      </button>
      {op.result && (
        <p className={`device-op-result ${op.result.ok ? '' : 'error'}`}>
          {op.result.ok ? op.result.message : op.result.error}
        </p>
      )}
    </div>
  )
}

export function DeviceSyncCard({ configured, onSyncComplete }: Props) {
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
            <div className="device-op-section">
              <h3 className="device-op-section-title">Pull from Device</h3>
              <div className="device-card-btn-row">
                <OpButton label="Pull Official Templates" loadingLabel="Pulling..." op={pullOfficial} />
                <OpButton label="Pull Methods Templates" loadingLabel="Pulling..." op={pullMethods} variant="secondary" />
              </div>
            </div>

            <div className="device-op-section">
              <h3 className="device-op-section-title">Deploy to Device</h3>
              <div className="device-card-btn-row">
                <OpButton label="Deploy via rm_methods" loadingLabel="Deploying..." op={deployMethods} />
                <OpButton label="Deploy Classic" loadingLabel="Deploying..." op={deployClassic} variant="secondary" />
              </div>
              <p className="device-card-hint">
                Classic deploy doesn't sync across devices. rm_methods is recommended.
              </p>
            </div>

            <div className="device-op-section">
              <h3 className="device-op-section-title">Rollback</h3>
              <div className="device-card-btn-row">
                <OpButton label="Rollback to Previous" loadingLabel="Rolling back..." op={rollbackMethods} variant="danger" />
                <OpButton label="Rollback to Original" loadingLabel="Rolling back..." op={rollbackOriginal} variant="danger" />
                <OpButton label="Rollback Classic" loadingLabel="Rolling back..." op={rollbackClassic} variant="danger" />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
