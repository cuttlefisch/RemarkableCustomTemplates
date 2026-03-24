/**
 * Reusable progress bar with phase label and determinate/indeterminate modes.
 * Uses the .device-progress CSS classes from DevicePage.css.
 */

import type { NdjsonProgress } from '../lib/ndjsonClient'

interface ProgressBarProps {
  /** NDJSON progress state (phase, current, total). null = indeterminate. */
  progress: NdjsonProgress | null
  /** Fallback label when progress is null. */
  label?: string
  /** Show the "keep device awake" tip below the bar. */
  showTip?: boolean
}

export function ProgressBar({ progress, label, showTip = false }: ProgressBarProps) {
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
      {showTip && progress && (
        <p className="device-progress-tip">
          Tip: Swipe or tap on your reMarkable screen to keep it awake — transfers go faster when the device isn't dozing.
        </p>
      )}
    </div>
  )
}
