import { useState, useCallback, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import './themes/tokens.css'
import './App.css'
import { NavBar } from './components/NavBar'
import { TemplatesPage } from './pages/TemplatesPage'
import { DevicePage } from './pages/DevicePage'
import { NotebookPage } from './pages/NotebookPage'
import { useRegistry, RegistryContext } from './hooks/useRegistry'
import { ThemeContext, useThemeProvider } from './hooks/useTheme'
import { BusyContext } from './hooks/useBusy'
import { getPreferredDeviceType, setPreferredDeviceType, type DeviceId } from './lib/renderer'

export default function App() {
  const registryState = useRegistry()
  const themeState = useThemeProvider()
  const [deviceId, setDeviceIdState] = useState<DeviceId>(getPreferredDeviceType)
  const [isBusy, setBusy] = useState(false)

  // Sync when preferred device changes from any page
  useEffect(() => {
    const handler = () => setDeviceIdState(getPreferredDeviceType())
    window.addEventListener('preferred-device-changed', handler)
    return () => window.removeEventListener('preferred-device-changed', handler)
  }, [])

  const setDeviceId = useCallback((id: DeviceId) => {
    setPreferredDeviceType(id) // dispatches event, which updates state via listener
  }, [])

  return (
    <ThemeContext.Provider value={themeState}>
      <BusyContext.Provider value={{ isBusy, setBusy }}>
        <RegistryContext.Provider value={registryState}>
          <div className="app-shell">
            <NavBar />
            <Routes>
              <Route path="/" element={<TemplatesPage deviceId={deviceId} setDeviceId={setDeviceId} />} />
              <Route path="/notebook" element={<NotebookPage />} />
              <Route path="/device" element={<DevicePage />} />
            </Routes>
          </div>
        </RegistryContext.Provider>
      </BusyContext.Provider>
    </ThemeContext.Provider>
  )
}
