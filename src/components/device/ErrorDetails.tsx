import { useState, type ReactNode } from 'react'

/**
 * Expandable error display with raw error details and a copy-to-clipboard
 * button that formats error info for GitHub bug reports.
 */
export function ErrorDetails({
  error,
  hint,
  rawError,
  details,
  operationName,
  deviceModel,
  firmwareVersion,
  className = 'device-op-result error',
  children,
}: {
  error: string
  hint?: string
  rawError?: string
  details?: string[]
  operationName?: string
  deviceModel?: string
  firmwareVersion?: string
  className?: string
  children?: ReactNode
}) {
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const lines = [
      `**Error:** ${error}`,
    ]
    if (operationName) lines.push(`**Operation:** ${operationName}`)
    lines.push(
      `**Hint:** ${hint ?? 'N/A'}`,
      `**Raw:** ${rawError ?? 'N/A'}`,
    )
    if (details?.length) lines.push(`**Details:**\n${details.map(d => `  - ${d}`).join('\n')}`)
    lines.push(
      `**Device:** ${deviceModel ?? 'N/A'}`,
      `**Firmware:** ${firmwareVersion ?? 'N/A'}`,
      `**URL:** ${window.location.href}`,
      `**Time:** ${new Date().toISOString()}`,
      `**UA:** ${navigator.userAgent}`,
    )
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={className}>
      <p style={{ margin: 0 }}>{error}</p>
      {hint && <p className="device-error-hint">{hint}</p>}
      {details && details.length > 0 && (
        <ul className="device-error-details">
          {details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      {rawError && rawError !== error && (
        <button className="device-error-toggle" onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? 'Hide details' : 'Show error details'}
        </button>
      )}
      {showRaw && rawError && (
        <pre className="device-error-raw">{rawError}</pre>
      )}
      <div className="device-error-actions">
        <button className="device-error-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy error for bug report'}
        </button>
      </div>
      {children}
    </div>
  )
}
