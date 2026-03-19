import { useState, useEffect } from 'react'
import type { UseDevices } from '../../hooks/useDevices'

interface Props {
  devicesState: UseDevices
}

export function DeviceConnectionCard({ devicesState }: Props) {
  const { devices, activeDevice, addDevice, updateDevice, removeDevice, testConnection, setupKeys } = devicesState

  const [showForm, setShowForm] = useState(false)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [formNickname, setFormNickname] = useState('')
  const [formIp, setFormIp] = useState('')
  const [formPort, setFormPort] = useState(22)
  const [formPassword, setFormPassword] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; deviceModel?: string; error?: string; hint?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [settingUpKeys, setSettingUpKeys] = useState(false)
  const [keyResult, setKeyResult] = useState<{ ok: boolean; error?: string; hint?: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)
  // Track the device ID we just created during the add flow, so we can test-connection with override
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null)

  // Whether the device being edited uses key auth (no password required)
  const editingKeyAuth = !isAddingNew && activeDevice?.authMethod === 'key'

  // Sync form fields when activeDevice changes while editing (not adding)
  useEffect(() => {
    if (showForm && !isAddingNew && activeDevice) {
      setFormNickname(activeDevice.nickname)
      setFormIp(activeDevice.deviceIp)
      setFormPort(activeDevice.sshPort)
      setFormPassword('')
      setTestResult(null)
      setKeyResult(null)
    }
  }, [activeDevice?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function openAddForm() {
    setFormNickname('')
    setFormIp('')
    setFormPort(22)
    setFormPassword('')
    setTestResult(null)
    setKeyResult(null)
    setIsAddingNew(true)
    setPendingDeviceId(null)
    setShowForm(true)
  }

  function openEditForm() {
    if (!activeDevice) return
    setFormNickname(activeDevice.nickname)
    setFormIp(activeDevice.deviceIp)
    setFormPort(activeDevice.sshPort)
    setFormPassword('')
    setTestResult(null)
    setKeyResult(null)
    setIsAddingNew(false)
    setPendingDeviceId(null)
    setShowForm(true)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    // If we're adding a new device and don't have a device ID yet, we need to create first
    if (isAddingNew && !pendingDeviceId) {
      // Create the device first, then test
      const device = await addDevice({
        nickname: formNickname || 'My reMarkable',
        deviceIp: formIp,
        sshPort: formPort,
        authMethod: 'password',
        sshPassword: formPassword,
      })
      if (!device) {
        setTestResult({ ok: false, error: 'Failed to create device' })
        setTesting(false)
        return
      }
      setPendingDeviceId(device.id)
      const result = await testConnection(device.id)
      setTestResult(result)
      setConnected(result.ok)
    } else {
      const id = pendingDeviceId ?? activeDevice?.id
      if (!id) { setTesting(false); return }

      if (editingKeyAuth && !formPassword) {
        // Key auth device, no password override — test with saved keys + form IP/port
        const result = await testConnection(id, {
          deviceIp: formIp,
          sshPort: formPort,
          authMethod: 'key',
        })
        setTestResult(result)
        setConnected(result.ok)
      } else {
        const result = await testConnection(id, {
          deviceIp: formIp,
          sshPort: formPort,
          authMethod: 'password',
          sshPassword: formPassword,
        })
        setTestResult(result)
        setConnected(result.ok)
      }
    }
    setTesting(false)
  }

  async function handleSave() {
    setSaving(true)
    if (isAddingNew) {
      if (pendingDeviceId) {
        // Device already created during test, just update with final values
        await updateDevice(pendingDeviceId, {
          nickname: formNickname || 'My reMarkable',
          deviceIp: formIp,
          sshPort: formPort,
          authMethod: 'password',
          sshPassword: formPassword,
        })
      } else {
        await addDevice({
          nickname: formNickname || 'My reMarkable',
          deviceIp: formIp,
          sshPort: formPort,
          authMethod: 'password',
          sshPassword: formPassword,
        })
      }
    } else if (activeDevice) {
      // Build update payload — only include password if provided
      const update: Record<string, unknown> = {
        nickname: formNickname,
        deviceIp: formIp,
        sshPort: formPort,
      }
      if (formPassword) {
        // User entered a new password — switch to password auth
        update.authMethod = 'password'
        update.sshPassword = formPassword
      }
      // If no password and key auth, keep existing auth method untouched
      await updateDevice(activeDevice.id, update)
    }
    setSaving(false)
    setShowForm(false)
    setPendingDeviceId(null)
  }

  async function handleSetupKeys() {
    if (!activeDevice) return
    setSettingUpKeys(true)
    setKeyResult(null)
    const result = await setupKeys(activeDevice.id)
    setKeyResult(result)
    setSettingUpKeys(false)
  }

  async function handleTestExisting() {
    if (!activeDevice) return
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(activeDevice.id)
    setTestResult(result)
    setConnected(result.ok)
    setTesting(false)
  }

  async function handleRemove() {
    if (!activeDevice) return
    await removeDevice(activeDevice.id)
    setConfirmRemove(false)
  }

  // Can save without testing if: editing key-auth device (just changing nickname/ip/port)
  const canSaveDirectly = !isAddingNew && editingKeyAuth
  // Can test: new device needs IP+password, existing key-auth just needs IP
  const canTest = isAddingNew
    ? !!(formIp && formPassword)
    : editingKeyAuth
      ? !!formIp
      : !!(formIp && formPassword)

  // Active device configured state
  if (activeDevice && !showForm) {
    return (
      <section className="device-card">
        <h2 className="device-card-title">
          Connection
          {activeDevice.nickname && (
            <span className="device-card-title-nickname"> — {activeDevice.nickname}</span>
          )}
        </h2>
        <div className="device-card-body">
          <div className="device-connection-status">
            <span className={`device-connection-dot ${connected === true ? 'connected' : connected === false ? 'error' : 'unknown'}`} />
            <span>
              {connected === true
                ? 'Connected'
                : connected === false
                  ? 'Connection failed'
                  : 'Not tested'}
            </span>
            {activeDevice.deviceModel && (
              <span className="device-connection-detail">{activeDevice.deviceModel}</span>
            )}
            <span className="device-connection-badge">
              {activeDevice.authMethod === 'key' ? 'SSH Key' : 'Password'}
            </span>
          </div>

          {activeDevice.lastConnected && (
            <p className="device-connection-detail" style={{ marginTop: 4 }}>
              Last connected: {new Date(activeDevice.lastConnected).toLocaleString()}
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

          {activeDevice.authMethod === 'password' && (
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
              onClick={openEditForm}
            >
              Edit Connection
            </button>
            <button
              className="device-card-btn device-card-btn-secondary"
              onClick={openAddForm}
            >
              Add Device
            </button>
            {devices.length > 1 && (
              confirmRemove ? (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className="device-card-btn device-card-btn-danger"
                    onClick={handleRemove}
                  >
                    Confirm Remove
                  </button>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={() => setConfirmRemove(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  className="device-card-btn device-card-btn-danger"
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove Device
                </button>
              )
            )}
          </div>

          {(testing || settingUpKeys) && (
            <div className="device-progress" style={{ marginTop: 8 }}>
              <div className="device-progress-label">
                {testing ? 'Testing connection...' : 'Setting up SSH keys...'}
              </div>
              <div className="device-progress-bar">
                <div className="device-progress-fill indeterminate" />
              </div>
            </div>
          )}

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
      <h2 className="device-card-title">
        {isAddingNew ? 'Add Device' : `Edit — ${activeDevice?.nickname ?? 'Connection'}`}
      </h2>
      <div className="device-card-body">
        {!showForm ? (
          <>
            <div className="device-connection-status">
              <span className="device-connection-dot unknown" />
              <span>No devices configured</span>
            </div>
            <p className="device-card-desc" style={{ marginTop: 8 }}>
              Connect to your reMarkable to pull and deploy templates over SSH.
            </p>
            <button className="device-card-btn" onClick={openAddForm}>
              Add Device
            </button>
          </>
        ) : (
          <div className="device-form">
            {isAddingNew && (
              <button
                className="device-form-help-toggle"
                onClick={() => setShowHelp(!showHelp)}
              >
                {showHelp ? 'Hide' : 'How to find your credentials'}
              </button>
            )}
            {isAddingNew && showHelp && (
              <div className="device-form-help">
                <p>On your reMarkable, go to <strong>Settings &rarr; General &rarr; Help &rarr; Copyrights and licenses</strong>.</p>
                <p>Your root password and IP address are shown at the bottom of the screen. Username is always <code>root</code>.</p>
                <p>Over WiFi, the IP is assigned by your router (typically something like <code>192.168.1.x</code>). Over USB, the IP is <code>10.11.99.1</code>.</p>
              </div>
            )}

            {editingKeyAuth && (
              <div className="device-connection-status" style={{ marginBottom: 4 }}>
                <span className="device-connection-badge">SSH Key</span>
                <span className="device-card-hint" style={{ margin: 0 }}>
                  Authenticated via SSH key — no password needed to save changes.
                </span>
              </div>
            )}

            <div className="device-form-field">
              <label className="device-form-label">Device Nickname</label>
              <input
                className="device-form-input"
                type="text"
                placeholder="My reMarkable"
                value={formNickname}
                onChange={e => setFormNickname(e.target.value)}
              />
            </div>

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

            {!editingKeyAuth && (
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
            )}

            {editingKeyAuth && (
              <button
                className="device-form-help-toggle"
                onClick={() => setShowHelp(!showHelp)}
                style={{ marginTop: 4 }}
              >
                {showHelp ? 'Hide password field' : 'Switch to password auth'}
              </button>
            )}
            {editingKeyAuth && showHelp && (
              <div className="device-form-field">
                <label className="device-form-label">Root Password</label>
                <input
                  className="device-form-input"
                  type="password"
                  placeholder="Enter to switch from SSH key to password auth"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                />
                <span className="device-card-hint" style={{ margin: 0 }}>
                  Entering a password will switch this device from SSH key to password authentication.
                </span>
              </div>
            )}

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
              {canSaveDirectly ? (
                /* Key-auth edit: can save directly or test first */
                <>
                  <button
                    className="device-card-btn"
                    onClick={handleSave}
                    disabled={saving || !formIp}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={handleTest}
                    disabled={testing || !canTest}
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={() => { setShowForm(false); setPendingDeviceId(null) }}
                  >
                    Cancel
                  </button>
                </>
              ) : !testResult?.ok ? (
                <>
                  <button
                    className="device-card-btn"
                    onClick={handleTest}
                    disabled={testing || !canTest}
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    className="device-card-btn device-card-btn-secondary"
                    onClick={() => { setShowForm(false); setPendingDeviceId(null) }}
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
                    onClick={() => { setShowForm(false); setPendingDeviceId(null) }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {(testing || saving) && (
              <div className="device-progress" style={{ marginTop: 8 }}>
                <div className="device-progress-label">
                  {testing ? 'Testing connection...' : 'Saving configuration...'}
                </div>
                <div className="device-progress-bar">
                  <div className="device-progress-fill indeterminate" />
                </div>
              </div>
            )}

            {testResult?.ok && !isAddingNew && activeDevice?.authMethod === 'password' && (
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
