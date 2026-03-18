import { useState } from 'react'
import { useRegistryContext } from '../hooks/useRegistry'
import { useDeviceConfig } from '../hooks/useDeviceConfig'
import { DeviceConnectionCard } from '../components/device/DeviceConnectionCard'
import { DeviceSyncCard } from '../components/device/DeviceSyncCard'
import { DeviceImportExportCard } from '../components/device/DeviceImportExportCard'
import { DeviceBackupsCard } from '../components/device/DeviceBackupsCard'
import './DevicePage.css'

export function DevicePage() {
  const { officialTemplatesAvailable } = useRegistryContext()
  const deviceConfig = useDeviceConfig()

  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function setStatus(msg: string) { setStatusMessage(msg); setErrorMessage(null) }
  function setError(msg: string) { setErrorMessage(msg); setStatusMessage(null) }

  return (
    <div className="device-page">
      <div className="device-page-inner">
        <h1 className="device-page-title">Device</h1>
        <p className="device-page-subtitle">
          Connect to your reMarkable, sync templates, and manage backups.
        </p>

        {statusMessage && <div className="device-status">{statusMessage}</div>}
        {errorMessage && <div className="device-error">{errorMessage}</div>}

        <DeviceConnectionCard config={deviceConfig} />
        <DeviceSyncCard configured={deviceConfig.configured} />
        <DeviceImportExportCard
          officialTemplatesAvailable={officialTemplatesAvailable}
          onStatus={setStatus}
          onError={setError}
        />
        <DeviceBackupsCard
          configured={deviceConfig.configured}
          onStatus={setStatus}
          onError={setError}
        />
      </div>
    </div>
  )
}
