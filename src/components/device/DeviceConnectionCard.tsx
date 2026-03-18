import { useState } from 'react'
import type { UseDeviceConfig } from '../../hooks/useDeviceConfig'

interface Props {
  config: UseDeviceConfig
}

export function DeviceConnectionCard({ config }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [formIp, setFormIp] = useState('')
  const [formPort, setFormPort] = useState(22)
  const [formPassword, setFormPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; deviceModel?: string; error?: string; hint?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [settingUpKeys, setSettingUpKeys] = useState(false)
  const [keyResult, setKeyResult] = useState<{ ok: boolean; error?: string; hint?: string } | null>(null)

  function openForm() {
    setFormIp(config.config?.deviceIp ?? '')
    setFormPort(config.config?.sshPort ?? 22)
    setFormPassword('')
    setTestResult(null)
    setKeyResult(null)
    setShowForm(true)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await config.testConnection({
      deviceIp: formIp,
      sshPort: formPort,
      authMethod: 'password',
      sshPassword: formPassword,
    })
    setTestResult(result)
    setTesting(false)
  }

  async function handleSave() {
    setSaving(true)
    const ok = await config.saveConfig({
      deviceIp: formIp,
      sshPort: formPort,
      authMethod: 'password',
      sshPassword: formPassword,
    })
    setSaving(false)
    if (ok) {
      setShowForm(false)
    }
  }

  async function handleSetupKeys() {
    setSettingUpKeys(true)
    setKeyResult(null)
    const result = await config.setupKeys()
    setKeyResult(result)
    setSettingUpKeys(false)
  }

  async function handleTestExisting() {
    setTesting(true)
    setTestResult(null)
    const result = await config.testConnection()
    setTestResult(result)
    setTesting(false)
  }

  // Connected state
  if (config.configured && !showForm) {
    return (
      <section className="device-card">
        <h2 className="device-card-title">Connection</h2>
        <div className="device-card-body">
          <div className="device-connection-status">
            <span className={`device-connection-dot ${config.connected === true ? 'connected' : config.connected === false ? 'error' : 'unknown'}`} />
            <span>
              {config.connected === true
                ? 'Connected'
                : config.connected === false
                  ? 'Connection failed'
                  : 'Not tested'}
            </span>
            {config.deviceModel && (
              <span className="device-connection-detail">{config.deviceModel}</span>
            )}
            <span className="device-connection-badge">
              {config.config?.authMethod === 'key' ? 'SSH Key' : 'Password'}
            </span>
          </div>

          {config.config?.lastConnected && (
            <p className="device-connection-detail" style={{ marginTop: 4 }}>
              Last connected: {new Date(config.config.lastConnected).toLocaleString()}
            </p>
          )}

          {testResult && !testResult.ok && (
            <div className="device-error" style={{ marginTop: 8, marginBottom: 8 }}>
              {testResult.error}
              {testResult.hint && (
                <p className="device-error-hint">{testResult.hint}</p>
              )}
            </div>
          )}

          {config.config?.authMethod === 'password' && (
            <div className="device-key-callout">
              <strong>Recommended:</strong> Set up SSH keys for a more reliable connection.
              The device password resets on every firmware update — SSH keys are permanent.
              <div style={{ marginTop: 8 }}>
                <button
                  className="device-card-btn device-card-btn-secondary"
                  onClick={handleSetupKeys}
                  disabled={settingUpKeys}
                >
                  {settingUpKeys ? 'Setting up...' : 'Set Up SSH Keys'}
                </button>
              </div>
            </div>
          )}

          <div className="device-card-btn-row" style={{ marginTop: 12 }}>
            <button
              className="device-card-btn"
              onClick={handleTestExisting}
              disabled={testing}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              className="device-card-btn device-card-btn-secondary"
              onClick={openForm}
            >
              Edit Connection
            </button>
          </div>

          {keyResult && (
            <div className={keyResult.ok ? 'device-card-hint' : 'device-error'} style={{ marginTop: 8 }}>
              {keyResult.ok ? 'SSH keys installed. Switched to key authentication.' : keyResult.error}
              {!keyResult.ok && keyResult.hint && (
                <p className="device-error-hint">{keyResult.hint}</p>
              )}
            </div>
          )}
        </div>
      </section>
    )
  }

  // Not configured / form state
  return (
    <section className="device-card">
      <h2 className="device-card-title">Connection</h2>
      <div className="device-card-body">
        {!showForm ? (
          <>
            <div className="device-connection-status">
              <span className="device-connection-dot unknown" />
              <span>Not connected</span>
            </div>
            <p className="device-card-desc" style={{ marginTop: 8 }}>
              Connect to your reMarkable to pull and deploy templates over SSH.
            </p>
            <button className="device-card-btn" onClick={openForm}>
              Set Up Connection
            </button>
          </>
        ) : (
          <div className="device-form">
            <button
              className="device-form-help-toggle"
              onClick={() => setShowHelp(!showHelp)}
            >
              {showHelp ? 'Hide' : 'How to find your credentials'}
            </button>
            {showHelp && (
              <div className="device-form-help">
                <p>On your reMarkable, go to <strong>Settings &rarr; General &rarr; Help &rarr; Copyrights and licenses</strong>.</p>
                <p>Your root password and IP address are shown at the bottom of the screen. Username is always <code>root</code>.</p>
                <p>Over WiFi, the IP is assigned by your router (typically something like <code>192.168.1.x</code>). Over USB, the IP is <code>10.11.99.1</code>.</p>
              </div>
            )}

            <div className="device-form-field">
              <label className="device-form-label">Device IP</label>
              <input
                className="device-form-input"
                type="text"
                placeholder="192.168.1.x"
                value={formIp}
                onChange={e => setFormIp(e.target.value)}
              />
            </div>

            <div className="device-form-field">
              <label className="device-form-label">SSH Port</label>
              <input
                className="device-form-input"
                type="number"
                value={formPort}
                onChange={e => setFormPort(Number(e.target.value))}
              />
            </div>

            <div className="device-form-field">
              <label className="device-form-label">Root Password</label>
              <input
                className="device-form-input"
                type="password"
                placeholder="From device settings"
                value={formPassword}
                onChange={e => setFormPassword(e.target.value)}
              />
            </div>

            {testResult && (
              <div className={testResult.ok ? 'device-status' : 'device-error'}>
                {testResult.ok
                  ? `Connected to ${testResult.deviceModel ?? 'device'}`
                  : testResult.error}
                {!testResult.ok && testResult.hint && (
                  <p className="device-error-hint">{testResult.hint}</p>
                )}
              </div>
            )}

            <div className="device-card-btn-row">
              {!testResult?.ok ? (
                <>
                  <button
                    className="device-card-btn"
                    onClick={handleTest}
                    disabled={testing || !formIp || !formPassword}
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="device-card-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save & Continue'}
                  </button>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {testResult?.ok && config.configured && (
              <p className="device-card-hint" style={{ marginTop: 8 }}>
                Recommended: Set up SSH keys now. The device password resets on every firmware update — SSH keys are permanent.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
