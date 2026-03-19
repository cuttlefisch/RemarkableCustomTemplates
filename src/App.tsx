import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './themes/tokens.css'
import './App.css'
import { NavBar } from './components/NavBar'
import { TemplatesPage } from './pages/TemplatesPage'
import { DevicePage } from './pages/DevicePage'
import { useRegistry, RegistryContext } from './hooks/useRegistry'
import { ThemeContext, useThemeProvider } from './hooks/useTheme'
import type { DeviceId } from './lib/renderer'

export default function App() {
  const registryState = useRegistry()
  const themeState = useThemeProvider()
  const [deviceId, setDeviceId] = useState<DeviceId>('rm')

  return (
    <ThemeContext.Provider value={themeState}>
      <RegistryContext.Provider value={registryState}>
        <div className="app-shell">
          <NavBar />
          <Routes>
            <Route path="/" element={<TemplatesPage deviceId={deviceId} setDeviceId={setDeviceId} />} />
            <Route path="/device" element={<DevicePage />} />
          </Routes>
        </div>
      </RegistryContext.Provider>
    </ThemeContext.Provider>
  )
}
