import { NavLink } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useBusy } from '../hooks/useBusy'
import './NavBar.css'

export function NavBar() {
  const { theme, setTheme, themes } = useTheme()
  const { isBusy } = useBusy()

  const handleClick = (e: React.MouseEvent) => {
    if (isBusy) e.preventDefault()
  }

  return (
    <nav className="nav-bar">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}${isBusy && !isActive ? ' disabled' : ''}`}
        onClick={handleClick}
      >
        Templates
      </NavLink>
      <NavLink
        to="/device"
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}${isBusy && !isActive ? ' disabled' : ''}`}
        onClick={handleClick}
      >
        Device
      </NavLink>
      {isBusy && <span className="nav-busy-hint">Operation in progress…</span>}
      <div className="theme-switcher">
        <select value={theme.id} onChange={e => setTheme(e.target.value)}>
          <optgroup label="Light">
            {themes.filter(t => t.group === 'light').map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Dark">
            {themes.filter(t => t.group === 'dark').map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
        </select>
      </div>
    </nav>
  )
}
