import { NavLink } from 'react-router-dom'
import './NavBar.css'

export function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        Templates
      </NavLink>
      <NavLink to="/device" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        Device &amp; Sync
      </NavLink>
    </nav>
  )
}
