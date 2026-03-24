import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Theme } from '../themes/themes'
import { themes, applyTheme, findTheme } from '../themes/themes'

const STORAGE_KEY = 'remarkable-templates-theme'
const DEFAULT_THEME_ID = 'gruvbox-light'

/** Map old theme IDs to new equivalents */
const MIGRATION: Record<string, string> = {
  light: 'github-light',
  classic: 'one-dark',
  sepia: 'gruvbox-light',
  dark: 'one-dark',
}

/** Value provided by ThemeContext — the active theme, setter, and all available themes. */
export interface ThemeContextValue {
  theme: Theme
  setTheme: (themeId: string) => void
  themes: Theme[]
}

/** React context for theme state. Must be provided by a parent using `useThemeProvider`. */
export const ThemeContext = createContext<ThemeContextValue>(null!)

/**
 * Initializes theme state from localStorage (with migration from legacy IDs),
 * applies CSS custom properties on change, and persists the selection.
 * Use at the app root to provide `ThemeContext`.
 *
 * @returns ThemeContextValue to pass into `ThemeContext.Provider`.
 */
export function useThemeProvider(): ThemeContextValue {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return themes[0]
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      // Try direct match first, then migration
      const direct = findTheme(stored)
      if (direct) return direct
      const migrated = MIGRATION[stored]
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, migrated)
        return findTheme(migrated) ?? themes[0]
      }
    }
    return findTheme(DEFAULT_THEME_ID) ?? themes[0]
  })

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((themeId: string) => {
    const next = findTheme(themeId)
    if (!next) return
    setThemeState(next)
    localStorage.setItem(STORAGE_KEY, themeId)
  }, [])

  return { theme, setTheme, themes }
}

/**
 * Consume the current theme from `ThemeContext`. Must be used within a `ThemeContext.Provider`.
 * @returns The active theme, setter function, and list of all available themes.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeContext.Provider')
  return ctx
}
