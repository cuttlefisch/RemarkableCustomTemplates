/**
 * Banner showing a recovered operation's status after page refresh.
 * Displays progress (if still running), success result, or error details.
 */

import type { ActiveOperation } from '../../hooks/useActiveOperation'
import { ProgressBar } from '../ProgressBar'
import { ErrorDetails } from './ErrorDetails'

/** Human-readable labels for operation names. */
const OP_LABELS: Record<string, string> = {
  'deploy-methods': 'Methods Deploy',
  'deploy-classic': 'Classic Deploy',
  'pull-official': 'Pull Classic',
  'pull-methods': 'Pull Methods',
  'rollback-methods': 'Rollback to Previous',
  'rollback-original': 'Rollback to Original',
  'remove-all': 'Remove All',
  'xovi-deploy': 'Extension Deploy',
  'xovi-remove': 'Extension Removal',
  'vellum-install-xovi': 'xovi Install',
  'vellum-remove-xovi': 'xovi Uninstall',
  'deploy-notebook': 'Notebook Deploy',
}

interface Props {
  op: ActiveOperation
  /** Only show if this operation name is in the set (used to scope per-card). */
  operationNames?: Set<string>
  onDismiss: () => void
  deviceModel?: string
  firmwareVersion?: string
}

export function RecoveredOperation({ op, operationNames, onDismiss, deviceModel, firmwareVersion }: Props) {
  // Filter: only show if this op belongs to the card
  if (operationNames && !operationNames.has(op.operationName)) return null

  const label = OP_LABELS[op.operationName] ?? op.operationName

  if (op.status === 'running') {
    return (
      <div className="device-op-recovered">
        <p className="device-op-recovered-label">
          <strong>{label}</strong> is still running...
        </p>
        <ProgressBar progress={op.lastProgress} label={`${label}...`} showTip />
      </div>
    )
  }

  if (op.status === 'done') {
    const message = (op.doneData?.message as string)
      ?? (op.doneData?.steps as string[] | undefined)?.join(' → ')
      ?? 'Completed successfully'
    return (
      <div className="device-op-recovered">
        <div className="device-op-result">
          <p style={{ margin: 0 }}><strong>{label}</strong> — {message}</p>
        </div>
        <button
          className="device-card-btn device-card-btn-secondary"
          onClick={onDismiss}
          style={{ marginTop: 6 }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  if (op.status === 'error' && op.errorData) {
    return (
      <div className="device-op-recovered">
        <p className="device-op-recovered-label">
          <strong>{label}</strong> failed:
        </p>
        <ErrorDetails
          error={op.errorData.message}
          hint={op.errorData.hint}
          rawError={op.errorData.rawError}
          deviceModel={deviceModel}
          firmwareVersion={firmwareVersion}
        />
        <button
          className="device-card-btn device-card-btn-secondary"
          onClick={onDismiss}
          style={{ marginTop: 6 }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  return null
}
