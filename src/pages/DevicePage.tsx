import { useState, useEffect } from 'react'
import { useRegistryContext } from '../hooks/useRegistry'
import { useDevices } from '../hooks/useDevices'
import { getPreferredDeviceType, deviceModelToDeviceId, setPreferredDeviceType, type DeviceId } from '../lib/renderer'
import { DeviceConnectionCard } from '../components/device/DeviceConnectionCard'
import { DeviceSyncCard } from '../components/device/DeviceSyncCard'
import { DeviceImportExportCard } from '../components/device/DeviceImportExportCard'
import { DeviceBackupsCard } from '../components/device/DeviceBackupsCard'
import './DevicePage.css'

export function DevicePage() {
  const { officialTemplatesAvailable, refreshRegistry } = useRegistryContext()
  const devicesState = useDevices()

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [backupsRefreshKey, setBackupsRefreshKey] = useState(0)
  const [preferredDevice, setPreferredDevice] = useState<DeviceId>(getPreferredDeviceType)

  function setStatus(msg: string) { setStatusMessage(msg); setErrorMessage(null) }
  function setError(msg: string) { setErrorMessage(msg); setStatusMessage(null) }
  function handleSyncComplete() { refreshRegistry(); setBackupsRefreshKey(k => k + 1) }

  const { devices, activeDevice, activeDeviceId, setActiveDevice, loading } = devicesState
  const configured = activeDevice !== null
  const deviceId = activeDevice?.id ?? null

  // Stay in sync when preferred device changes (from this page or others)
  useEffect(() => {
    const handler = () => setPreferredDevice(getPreferredDeviceType())
    window.addEventListener('preferred-device-changed', handler)
    return () => window.removeEventListener('preferred-device-changed', handler)
  }, [])

  function handlePreferredChange(id: DeviceId) {
    setPreferredDeviceType(id)
  }

  return (
    <div className="device-page">
      <div className="device-page-inner">
        <h1 className="device-page-title">Devices</h1>
        <p className="device-page-subtitle">
          Connect to your reMarkable devices, sync templates, and manage backups.
        </p>

        {statusMessage && <div className="device-status">{statusMessage}</div>}
        {errorMessage && <div className="device-error">{errorMessage}</div>}

        {!loading && devices.length > 1 && (
          <div className="device-selector-bar">
            {devices.map(d => {
              const isPreferred = d.deviceModel
                ? deviceModelToDeviceId(d.deviceModel) === preferredDevice
                : false
              return (
                <button
                  key={d.id}
                  className={`device-selector-tab${d.id === (activeDeviceId ?? devices[0]?.id) ? ' active' : ''}`}
                  onClick={() => setActiveDevice(d.id)}
                >
                  <span className="device-selector-tab-name">{d.nickname}</span>
                  {d.deviceModel && (
                    <span className="device-selector-tab-model">{d.deviceModel}</span>
                  )}
                  {isPreferred && <span className="device-preferred-badge">Preferred</span>}
                </button>
              )
            })}
          </div>
        )}

        <DeviceConnectionCard devicesState={devicesState} preferredDevice={preferredDevice} onPreferredChange={handlePreferredChange} />
        <DeviceSyncCard deviceId={deviceId} deviceName={activeDevice?.nickname ?? 'Device'} configured={configured} deviceModel={activeDevice?.deviceModel} firmwareVersion={activeDevice?.firmwareVersion} onSyncComplete={handleSyncComplete} />
        <DeviceImportExportCard
          officialTemplatesAvailable={officialTemplatesAvailable}
          onStatus={setStatus}
          onError={setError}
          onRefreshRegistry={refreshRegistry}
        />
        <DeviceBackupsCard
          deviceId={deviceId}
          deviceName={activeDevice?.nickname ?? 'Device'}
          configured={configured}
          onStatus={setStatus}
          onError={setError}
          refreshKey={backupsRefreshKey}
        />
      </div>
    </div>
  )
}
