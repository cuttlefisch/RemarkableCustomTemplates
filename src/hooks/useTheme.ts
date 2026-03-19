import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Theme } from '../themes/themes'
import { themes, applyTheme, findTheme } from '../themes/themes'

const STORAGE_KEY = 'remarkable-templates-theme'
const DEFAULT_THEME_ID = 'github-light'

/** Map old theme IDs to new equivalents */
const MIGRATION: Record<string, string> = {
  light: 'github-light',
  classic: 'one-dark',
  sepia: 'gruvbox-light',
  dark: 'one-dark',
}

export interface ThemeContextValue {
  theme: Theme
  setTheme: (themeId: string) => void
  themes: Theme[]
}

export const ThemeContext = createContext<ThemeContextValue>(null!)

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

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeContext.Provider')
  return ctx
}
