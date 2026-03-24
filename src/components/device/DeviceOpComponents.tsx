/**
 * Shared React components for device operation UI (ProgressBar, OpButton).
 * Separated from deviceOpHelpers.ts to satisfy react-refresh/only-export-components.
 */

import { ErrorDetails } from './ErrorDetails'
import type { useDeviceOp, ProgressState } from './deviceOpHelpers'

export function ProgressBar({ progress, label }: { progress: ProgressState | null; label?: string }) {
  const phase = progress?.phase ?? label
  const pct = progress?.current != null && progress?.total
    ? Math.round((progress.current / progress.total) * 100)
    : null

  return (
    <div className="device-progress">
      <div className="device-progress-label">
        {phase}
        {pct != null && ` ${progress!.current}/${progress!.total}`}
      </div>
      <div className="device-progress-bar">
        <div
          className={`device-progress-fill${pct == null ? ' indeterminate' : ''}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      {progress && (
        <p className="device-progress-tip">
          Tip: Swipe or tap on your reMarkable screen to keep it awake — transfers go faster when the device isn't dozing.
        </p>
      )}
    </div>
  )
}

export function OpButton({
  label,
  loadingLabel,
  op,
  variant = 'primary',
  disabled = false,
  title,
  deviceModel,
  firmwareVersion,
}: {
  label: string
  loadingLabel: string
  op: ReturnType<typeof useDeviceOp>
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  title?: string
  deviceModel?: string
  firmwareVersion?: string
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
      {op.loading && (
        <ProgressBar progress={op.progress} label={loadingLabel} />
      )}
      {op.result && !op.result.ok && (
        <ErrorDetails error={op.result.error} hint={op.result.hint} rawError={op.result.rawError} deviceModel={deviceModel} firmwareVersion={firmwareVersion} />
      )}
      {op.result?.ok && (
        <div className="device-op-result">
          <p style={{ margin: 0 }}>{op.result.message}</p>
        </div>
      )}
    </div>
  )
}
