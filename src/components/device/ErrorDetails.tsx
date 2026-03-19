import { useState, type ReactNode } from 'react'

/**
 * Expandable error display with raw error details and a copy-to-clipboard
 * button that formats error info for GitHub bug reports.
 */
export function ErrorDetails({
  error,
  hint,
  rawError,
  className = 'device-op-result error',
  children,
}: {
  error: string
  hint?: string
  rawError?: string
  className?: string
  children?: ReactNode
}) {
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = [
      `**Error:** ${error}`,
      `**Raw:** ${rawError ?? 'N/A'}`,
      `**Hint:** ${hint ?? 'N/A'}`,
      `**URL:** ${window.location.href}`,
      `**Time:** ${new Date().toISOString()}`,
      `**UA:** ${navigator.userAgent}`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={className}>
      <p style={{ margin: 0 }}>{error}</p>
      {hint && <p className="device-error-hint">{hint}</p>}
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
