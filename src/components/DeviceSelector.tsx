import { Link } from 'react-router-dom'
import type { UseDevices } from '../hooks/useDevices'
import './DeviceSelector.css'

interface Props {
  /** Device state from the parent's useDevices() hook */
  devicesState: UseDevices
  /** Optional className for the wrapper */
  className?: string
}

/**
 * Compact device selector dropdown. Shows the active device and allows switching.
 * Controlled component — receives device state from parent to avoid stale state bugs.
 */
export function DeviceSelector({ devicesState, className }: Props) {
  const { devices, activeDeviceId, activeDevice, setActiveDevice, loading } = devicesState

  if (loading) return null

  if (devices.length === 0) {
    return (
      <span className={`device-selector-inline ${className ?? ''}`}>
        <Link to="/device" className="device-selector-configure">Configure a device</Link>
      </span>
    )
  }

  if (devices.length === 1) {
    return (
      <span className={`device-selector-inline ${className ?? ''}`}>
        <span className="device-selector-single" title={`Deploy target: ${activeDevice?.nickname ?? 'Device'} (${activeDevice?.deviceIp ?? ''})`}>
          <span className="device-selector-label">Deploy to: </span>{activeDevice?.nickname ?? 'Device'}
        </span>
      </span>
    )
  }

  return (
    <select
      className={`device-selector-dropdown ${className ?? ''}`}
      value={activeDeviceId ?? ''}
      onChange={e => setActiveDevice(e.target.value)}
      title="Select deploy target device"
    >
      {devices.map(d => (
        <option key={d.id} value={d.id}>{d.nickname}</option>
      ))}
    </select>
  )
}
