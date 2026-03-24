/**
 * Shared React components for device operation UI (OpButton).
 * ProgressBar is re-exported from the canonical shared component.
 * Separated from deviceOpHelpers.ts to satisfy react-refresh/only-export-components.
 */

import { ErrorDetails } from './ErrorDetails'
import { ProgressBar } from '../ProgressBar'
import type { useDeviceOp } from './deviceOpHelpers'

// Re-export so existing consumers (DeviceXoviCard) don't break
export { ProgressBar }

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
        <ProgressBar progress={op.progress} label={loadingLabel} showTip />
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
