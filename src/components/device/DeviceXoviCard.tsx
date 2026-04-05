/**
 * DeviceXoviCard — deploy/manage curated xovi QMD extensions on the device.
 *
 * Requires xovi + qt-resource-rebuilder to be installed on the device (via Vellum).
 * This component only manages QMD extension files.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useBusy } from '../../hooks/useBusy'
import { ErrorDetails } from './ErrorDetails'
import { readNdjsonStream } from './deviceOpHelpers'
import type { OpResult, ProgressState } from './deviceOpHelpers'
import { ProgressBar } from './DeviceOpComponents'

function downloadLog(log: string, filename: string) {
  const blob = new Blob([log], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  deviceId: string | null
  deviceName: string
  configured: boolean
  deviceModel?: string
  firmwareVersion?: string
}

// ── Types mirroring server/lib/xoviExtensions.ts ─────────────────────────────

interface XoviExtensionStatus {
  id: string
  displayName: string
  description: string
  tier: 1 | 2
  installed: boolean
  available: boolean
  exclusiveGroup?: string
  filename: string
}

interface XoviDeviceStatus {
  xoviInstalled: boolean
  qtRebuilderInstalled: boolean
  extensions: XoviExtensionStatus[]
  firmwareVersion: string | null
  qmdVersion: string | null
  vellumInstalled: boolean
  vellumVersion: string | null
  vellumReenableNeeded: boolean
  supportedVersionRange: { min: string; max: string } | null
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useXoviStatus(deviceId: string | null) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<XoviDeviceStatus | null>(null)
  const [error, setError] = useState<{ message: string; hint?: string; rawError?: string } | null>(null)

  const check = useCallback(async () => {
    if (!deviceId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}/xovi-status`, { method: 'POST' })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        setError({
          message: (data.error as string) ?? `HTTP ${res.status}`,
          hint: data.hint as string | undefined,
          rawError: data.rawError as string | undefined,
        })
        setStatus(null)
      } else {
        setStatus(data as unknown as XoviDeviceStatus)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError({ message: msg, rawError: msg })
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  const clear = useCallback(() => { setStatus(null); setError(null) }, [])
  useEffect(() => { clear() }, [deviceId, clear])

  return { loading, status, error, check, clear }
}

function useXoviOp(deviceId: string | null) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OpResult | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  async function run(endpoint: 'xovi-deploy' | 'xovi-remove', extensionIds: string[]) {
    if (!deviceId) return
    setLoading(true)
    setResult(null)
    setProgress(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionIds }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      let data: Record<string, unknown>
      if (contentType.includes('application/x-ndjson')) {
        data = await readNdjsonStream(res, setProgress)
      } else {
        data = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          setResult({ ok: false, error: (data.error as string) ?? `HTTP ${res.status}`, hint: data.hint as string | undefined, rawError: data.rawError as string | undefined })
          return
        }
      }
      const steps = data.steps as string[] | undefined
      const log = data.log as string | undefined
      setResult({ ok: true, message: steps?.join(' \u2192 ') ?? 'Done', steps, log })
    } catch (e) {
      if (e && typeof e === 'object' && 'error' in e) {
        const streamErr = e as { error: string; hint?: string; rawError?: string }
        setResult({ ok: false, error: streamErr.error, hint: streamErr.hint, rawError: streamErr.rawError })
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        setResult({ ok: false, error: msg, rawError: msg })
      }
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return { loading, result, progress, run, clearResult: () => setResult(null) }
}

function useVellumOp(deviceId: string | null) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OpResult | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)

  async function run(endpoint: 'vellum-install-xovi' | 'vellum-remove-xovi') {
    if (!deviceId) return
    setLoading(true)
    setResult(null)
    setProgress(null)
    try {
      const res = await fetch(`/api/devices/${deviceId}/${endpoint}`, { method: 'POST' })
      const contentType = res.headers.get('content-type') ?? ''
      let data: Record<string, unknown>
      if (contentType.includes('application/x-ndjson')) {
        data = await readNdjsonStream(res, setProgress)
      } else {
        data = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          setResult({ ok: false, error: (data.error as string) ?? `HTTP ${res.status}`, hint: data.hint as string | undefined, rawError: data.rawError as string | undefined })
          return
        }
      }
      const message = (data.message as string) ?? (data.steps as string[] | undefined)?.join(' \u2192 ') ?? 'Done'
      setResult({ ok: true, message })
    } catch (e) {
      if (e && typeof e === 'object' && 'error' in e) {
        const streamErr = e as { error: string; hint?: string; rawError?: string }
        setResult({ ok: false, error: streamErr.error, hint: streamErr.hint, rawError: streamErr.rawError })
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        setResult({ ok: false, error: msg, rawError: msg })
      }
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return { loading, result, progress, run, clearResult: () => setResult(null) }
}

// ── Helpers ──────────────────────────────────────────────────────────────────


const DISCLAIMER_KEY = 'xoviDisclaimerAccepted'

// ── Component ────────────────────────────────────────────────────────────────

export function DeviceXoviCard({ deviceId, deviceName, configured, deviceModel, firmwareVersion }: Props) {
  const xoviStatus = useXoviStatus(deviceId)
  const xoviOp = useXoviOp(deviceId)
  const vellumOp = useVellumOp(deviceId)
  const [helpOpen, setHelpOpen] = useState(false)

  // Compute default selections from status
  const defaultExtensions = useMemo(() => {
    if (!xoviStatus.status) return new Set<string>()
    const ids = new Set<string>()
    for (const ext of xoviStatus.status.extensions) {
      if (!ext.exclusiveGroup && (ext.installed || ext.available)) {
        ids.add(ext.id)
      }
    }
    return ids
  }, [xoviStatus.status])

  const defaultPageSize = useMemo(() => {
    if (!xoviStatus.status) return null
    // Only pre-select if one is already deployed; default to None otherwise
    const installedPS = xoviStatus.status.extensions.find(e => e.exclusiveGroup === 'pageSize' && e.installed)
    return installedPS?.id ?? null
  }, [xoviStatus.status])

  // Extension selection state — reset to defaults when status changes
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set())
  const [selectedPageSize, setSelectedPageSize] = useState<string | null>(null)

  useEffect(() => {
    setSelectedExtensions(defaultExtensions)
  }, [defaultExtensions])

  useEffect(() => {
    setSelectedPageSize(defaultPageSize)
  }, [defaultPageSize])

  function toggleExtension(id: string) {
    setSelectedExtensions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getDeployIds(): string[] {
    const ids = [...selectedExtensions]
    if (selectedPageSize) ids.push(selectedPageSize)
    return ids
  }

  async function handleDeploy() {
    const ids = getDeployIds()
    if (ids.length === 0) return

    // Disclaimer check
    if (!localStorage.getItem(DISCLAIMER_KEY)) {
      const accepted = window.confirm(
        'xovi extensions modify your device\'s UI behavior at runtime. ' +
        'These are community-maintained modifications, not endorsed by reMarkable. ' +
        'This may void your warranty. All changes are reversible by removing the extensions.\n\n' +
        'Extensions may need to be re-deployed after firmware updates.\n\n' +
        'Do you understand and wish to proceed?',
      )
      if (!accepted) return
      localStorage.setItem(DISCLAIMER_KEY, 'true')
    }

    xoviOp.clearResult()
    await xoviOp.run('xovi-deploy', ids)
    xoviStatus.check() // refresh status after deploy
  }

  async function handleRemoveAll() {
    if (!xoviStatus.status) return
    const installedIds = xoviStatus.status.extensions
      .filter(e => e.installed)
      .map(e => e.id)
    if (installedIds.length === 0) return

    if (!window.confirm(`Remove all ${installedIds.length} extension(s) from ${deviceName}?`)) return

    xoviOp.clearResult()
    await xoviOp.run('xovi-remove', installedIds)
    xoviStatus.check()
  }

  async function handleVellumInstall() {
    vellumOp.clearResult()
    await vellumOp.run('vellum-install-xovi')
    xoviStatus.check() // refresh to show xovi as installed
  }

  async function handleVellumRemove() {
    if (!window.confirm(
      `This will uninstall xovi, xovi-extensions (qt-resource-rebuilder), and all deployed QMD extensions from ${deviceName}. Continue?`,
    )) return
    vellumOp.clearResult()
    await vellumOp.run('vellum-remove-xovi')
    xoviStatus.check()
  }

  const status = xoviStatus.status
  const xoviReady = status?.xoviInstalled && status?.qtRebuilderInstalled
  const hasAvailable = status?.extensions.some(e => e.available) ?? false
  const hasInstalled = status?.extensions.some(e => e.installed) ?? false
  const anyLoading = xoviStatus.loading || xoviOp.loading || vellumOp.loading

  // Block page navigation while an operation is running
  const { setBusy } = useBusy()
  useEffect(() => {
    if (!anyLoading) return
    setBusy(true)
    return () => setBusy(false)
  }, [anyLoading, setBusy])

  return (
    <div className="device-card">
      <h2 className="device-card-title">xovi Extensions</h2>

      <div className="device-card-body">
      {/* Collapsible help */}
      <button
        className="device-form-help-toggle"
        onClick={() => setHelpOpen(!helpOpen)}
        type="button"
      >
        {helpOpen ? 'Hide' : 'What are xovi extensions?'}
      </button>

      {helpOpen && (
        <div className="device-form-help">
          <p>
            <strong>xovi</strong> is a community framework that lets you tweak the reMarkable UI
            without permanently modifying system files. Extensions are small patch files (.qmd)
            that modify UI behavior at startup.
          </p>
          <p>
            This app deploys curated extensions to enhance your template experience:
            unlocking Methods templates without a subscription, normalizing page dimensions
            across devices, and improving quicksheet behavior.
          </p>
          <p>
            If you have the{' '}
            <a href="https://remarkable.guide/guide/software/vellum.html" target="_blank" rel="noopener noreferrer">
              Vellum package manager
            </a>
            {' '}on your device, you can install xovi directly from this app. Otherwise,
            install Vellum first, then use the Install button or
            run <code>vellum add qt-resource-rebuilder</code> via SSH.
          </p>
        </div>
      )}

      {/* Warning banner */}
      <p className="xovi-disclaimer">
        Extensions modify device UI behavior. Requires xovi on your device —
        install it below via Vellum, or{' '}
        <a href="https://remarkable.guide/guide/software/vellum.html" target="_blank" rel="noopener noreferrer">
          see the Vellum guide
        </a>.
      </p>

      {!configured && (
        <p className="device-card-warning">Connect a device to manage extensions.</p>
      )}

      {configured && (
        <>
          {/* Status check */}
          <div className="device-op-section">
            <button
              className="device-card-btn"
              onClick={() => { xoviOp.clearResult(); vellumOp.clearResult(); xoviStatus.check() }}
              disabled={anyLoading}
            >
              {xoviStatus.loading ? 'Checking...' : 'Check xovi Status'}
            </button>

            {xoviStatus.error && (
              <ErrorDetails
                error={xoviStatus.error.message}
                hint={xoviStatus.error.hint}
                rawError={xoviStatus.error.rawError}
                operationName="xovi-status"
                deviceModel={deviceModel}
                firmwareVersion={firmwareVersion}
              />
            )}
          </div>

          {status && (
            <>
              {/* Infrastructure status */}
              <div className="xovi-status-section">
                <div className="xovi-status-row">
                  <span className={`xovi-status-badge ${status.xoviInstalled ? 'installed' : 'missing'}`}>
                    {status.xoviInstalled ? '\u2713' : '\u2717'}
                  </span>
                  <span>xovi core</span>
                </div>
                <div className="xovi-status-row">
                  <span className={`xovi-status-badge ${status.qtRebuilderInstalled ? 'installed' : 'missing'}`}>
                    {status.qtRebuilderInstalled ? '\u2713' : '\u2717'}
                  </span>
                  <span>qt-resource-rebuilder</span>
                </div>
                <div className="xovi-status-row">
                  <span className={`xovi-status-badge ${status.vellumInstalled ? 'installed' : 'missing'}`}>
                    {status.vellumInstalled ? '\u2713' : '\u2717'}
                  </span>
                  <span>Vellum{status.vellumVersion ? ` ${status.vellumVersion}` : ''}</span>
                </div>
                {status.firmwareVersion && (
                  <div className="xovi-status-row">
                    <span className={`xovi-status-badge ${status.qmdVersion ? 'installed' : 'missing'}`}>
                      {status.qmdVersion ? '\u2713' : '\u2717'}
                    </span>
                    <span>
                      Firmware {status.firmwareVersion}
                      {status.qmdVersion
                        ? ` \u2192 extensions v${status.qmdVersion}`
                        : status.supportedVersionRange
                          ? ` (unsupported \u2014 bundled extensions cover ${status.supportedVersionRange.min}\u2013${status.supportedVersionRange.max})`
                          : ' (unsupported)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Vellum reenable warning */}
              {status.vellumReenableNeeded && (
                <div className="xovi-reenable-warning">
                  <p><strong>Firmware update detected.</strong> Vellum needs to be re-enabled before packages can be installed or updated.</p>
                  <p>SSH into your device and run:</p>
                  <pre className="xovi-install-cmd">vellum reenable</pre>
                  <p>Then check status again.</p>
                </div>
              )}

              {/* xovi not installed — interactive install or static guidance */}
              {!xoviReady && !status.vellumReenableNeeded && (
                <div className="xovi-install-guidance">
                  <p>
                    <strong>xovi is not fully installed on {deviceName}.</strong>
                  </p>
                  {status.vellumInstalled ? (
                    <>
                      <p>
                        Install xovi and qt-resource-rebuilder via Vellum.
                        Requires internet access on the device.
                      </p>
                      <button
                        className="device-card-btn"
                        onClick={handleVellumInstall}
                        disabled={anyLoading}
                      >
                        {vellumOp.loading ? 'Installing...' : 'Install xovi'}
                      </button>
                      {vellumOp.loading && (
                        <ProgressBar progress={vellumOp.progress} label="Installing xovi via Vellum..." />
                      )}
                      {vellumOp.result && !vellumOp.result.ok && (
                        <ErrorDetails
                          error={vellumOp.result.error}
                          hint={vellumOp.result.hint}
                          rawError={vellumOp.result.rawError}
                          operationName="vellum-install-xovi"
                          deviceModel={deviceModel}
                          firmwareVersion={firmwareVersion}
                        />
                      )}
                      {vellumOp.result?.ok && (
                        <div className="device-op-result">
                          <p style={{ margin: 0 }}>{vellumOp.result.message}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        First,{' '}
                        <a href="https://remarkable.guide/guide/software/vellum.html" target="_blank" rel="noopener noreferrer">
                          install the Vellum package manager
                        </a>
                        {' '}on your device. Then SSH in and run:
                      </p>
                      <pre className="xovi-install-cmd">vellum add qt-resource-rebuilder</pre>
                      <p>
                        This installs xovi, xovi-extensions, and qt-resource-rebuilder. Restart your
                        device, then check status again.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Extensions list */}
              {xoviReady && !hasAvailable && status.qmdVersion === null && (
                <div className="device-card-warning">
                  <p>
                    <strong>No extensions available for firmware {status.firmwareVersion}.</strong>
                  </p>
                  <p>
                    This app bundles extensions for firmware{' '}
                    {status.supportedVersionRange
                      ? `${status.supportedVersionRange.min}–${status.supportedVersionRange.max}`
                      : 'versions not detected'}.{' '}
                    QMD extensions target firmware-specific internals and cannot be safely used across versions.
                    Check for an app update or visit{' '}
                    <a href="https://github.com/rmitchellscott/xovi" target="_blank" rel="noopener noreferrer">
                      xovi on GitHub
                    </a>{' '}
                    for the latest extensions.
                  </p>
                </div>
              )}

              {xoviReady && hasAvailable && (
                <div className="xovi-extension-list">
                  {/* Tier 1: Essential */}
                  <h3 className="xovi-tier-label">Essential</h3>
                  {status.extensions
                    .filter(e => e.tier === 1 && !e.exclusiveGroup && e.available)
                    .map(ext => (
                      <label key={ext.id} className="xovi-extension-entry">
                        <input
                          type="checkbox"
                          checked={selectedExtensions.has(ext.id)}
                          onChange={() => toggleExtension(ext.id)}
                          disabled={anyLoading}
                        />
                        <div className="xovi-extension-info">
                          <span className="xovi-extension-name">{ext.displayName}</span>
                          <span className={`xovi-deploy-badge ${ext.installed ? 'deployed' : 'not-deployed'}`}>
                            {ext.installed ? 'Deployed' : 'Not deployed'}
                          </span>
                        </div>
                        <span className="xovi-extension-desc">{ext.description}</span>
                      </label>
                    ))}

                  {/* Page size radio group */}
                  {status.extensions.some(e => e.exclusiveGroup === 'pageSize' && e.available) && (
                    <div className="xovi-radio-group">
                      <div className="xovi-extension-name">Page Size Normalization</div>
                      <span className="xovi-extension-desc">
                        Only needed if you sync between different device types.
                        Forces new pages to match a different device's dimensions so
                        they render correctly on that device. Pick the size of the
                        device you <strong>sync to</strong>: <strong>RM2 Size</strong> for
                        a reMarkable 1/2, or <strong>Paper Pro Size</strong> for a Paper Pro.
                        Choose <strong>None</strong> if you only use one device or want
                        pages optimized for this device.
                      </span>
                      {status.extensions
                        .filter(e => e.exclusiveGroup === 'pageSize' && e.available)
                        .map(ext => (
                          <label key={ext.id} className="xovi-radio-entry">
                            <input
                              type="radio"
                              name="pageSize"
                              checked={selectedPageSize === ext.id}
                              onChange={() => setSelectedPageSize(ext.id)}
                              disabled={anyLoading}
                            />
                            <span>{ext.displayName}</span>
                            <span className={`xovi-deploy-badge ${ext.installed ? 'deployed' : 'not-deployed'}`}>
                              {ext.installed ? 'Deployed' : ''}
                            </span>
                          </label>
                        ))}
                      <label className="xovi-radio-entry">
                        <input
                          type="radio"
                          name="pageSize"
                          checked={selectedPageSize === null}
                          onChange={() => setSelectedPageSize(null)}
                          disabled={anyLoading}
                        />
                        <span>None</span>
                      </label>
                    </div>
                  )}

                  {/* Tier 2: Recommended */}
                  {status.extensions.some(e => e.tier === 2 && e.available) && (
                    <>
                      <h3 className="xovi-tier-label">Recommended</h3>
                      {status.extensions
                        .filter(e => e.tier === 2 && e.available)
                        .map(ext => (
                          <label key={ext.id} className="xovi-extension-entry">
                            <input
                              type="checkbox"
                              checked={selectedExtensions.has(ext.id)}
                              onChange={() => toggleExtension(ext.id)}
                              disabled={anyLoading}
                            />
                            <div className="xovi-extension-info">
                              <span className="xovi-extension-name">{ext.displayName}</span>
                              <span className={`xovi-deploy-badge ${ext.installed ? 'deployed' : 'not-deployed'}`}>
                                {ext.installed ? 'Deployed' : 'Not deployed'}
                              </span>
                            </div>
                            <span className="xovi-extension-desc">{ext.description}</span>
                          </label>
                        ))}
                    </>
                  )}

                  {/* Actions */}
                  <div className="device-card-btn-row" style={{ marginTop: 12 }}>
                    <button
                      className="device-card-btn"
                      onClick={handleDeploy}
                      disabled={anyLoading || getDeployIds().length === 0}
                    >
                      {xoviOp.loading ? 'Deploying...' : 'Deploy Selected'}
                    </button>
                    {hasInstalled && (
                      <button
                        className="device-card-btn device-card-btn-danger"
                        onClick={handleRemoveAll}
                        disabled={anyLoading}
                      >
                        Remove All Extensions
                      </button>
                    )}
                    {status.vellumInstalled && (
                      <button
                        className="device-card-btn device-card-btn-danger"
                        onClick={handleVellumRemove}
                        disabled={anyLoading}
                        title="Uninstall xovi, qt-resource-rebuilder, and all extensions via Vellum"
                      >
                        Uninstall xovi
                      </button>
                    )}
                  </div>

                  {/* Vellum operation progress/result */}
                  {vellumOp.loading && (
                    <ProgressBar progress={vellumOp.progress} label="Working..." />
                  )}
                  {vellumOp.result && !vellumOp.result.ok && (
                    <ErrorDetails
                      error={vellumOp.result.error}
                      hint={vellumOp.result.hint}
                      rawError={vellumOp.result.rawError}
                      operationName="vellum-remove-xovi"
                      deviceModel={deviceModel}
                      firmwareVersion={firmwareVersion}
                    />
                  )}
                  {vellumOp.result?.ok && (
                    <div className="device-op-result">
                      <p style={{ margin: 0 }}>{vellumOp.result.message}</p>
                    </div>
                  )}

                  {/* Progress */}
                  {xoviOp.loading && (
                    <ProgressBar progress={xoviOp.progress} label="Deploying..." />
                  )}

                  {/* Result */}
                  {xoviOp.result && !xoviOp.result.ok && (
                    <ErrorDetails
                      error={xoviOp.result.error}
                      hint={xoviOp.result.hint}
                      rawError={xoviOp.result.rawError}
                      details={xoviOp.result.details}
                      operationName="xovi-deploy"
                      deviceModel={deviceModel}
                      firmwareVersion={firmwareVersion}
                    />
                  )}
                  {xoviOp.result?.ok && (
                    <div className="device-op-result">
                      <p style={{ margin: 0 }}>
                        {xoviOp.result.steps?.join(' \u2192 ') ?? 'Done'}
                        {xoviOp.result.log && (
                          <>
                            {' \u2014 '}
                            <button
                              className="xovi-download-log-btn"
                              onClick={() => downloadLog(xoviOp.result!.ok ? xoviOp.result!.log! : '', `xovi-log-${Date.now()}.txt`)}
                              type="button"
                            >
                              Download log
                            </button>
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Firmware update warning */}
              <p className="device-card-warning" style={{ marginTop: 12 }}>
                Extensions may need to be re-deployed after a firmware update. Modifying device
                behavior may void warranty.
              </p>
            </>
          )}
        </>
      )}
      </div>
    </div>
  )
}
