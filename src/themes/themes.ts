/** Monaco standalone theme data (mirrors editor.IStandaloneThemeData) */
export interface MonacoThemeData {
  base: 'vs' | 'vs-dark' | 'hc-black'
  inherit: boolean
  rules: Array<{ token: string; foreground?: string; background?: string; fontStyle?: string }>
  colors: Record<string, string>
}

export interface Theme {
  id: string
  name: string
  group: 'light' | 'dark'
  tokens: Record<string, string>
  monacoTheme: MonacoThemeData
}

import { githubLight } from './palettes/github-light'
import { oneLight } from './palettes/one-light'
import { solarizedLight } from './palettes/solarized-light'
import { gruvboxLight } from './palettes/gruvbox-light'
import { oneDark } from './palettes/one-dark'
import { dracula } from './palettes/dracula'
import { gruvboxDark } from './palettes/gruvbox-dark'
import { nord } from './palettes/nord'
import { solarizedDark } from './palettes/solarized-dark'
import { tokyoNight } from './palettes/tokyo-night'

export const themes: Theme[] = [
  githubLight,
  oneLight,
  solarizedLight,
  gruvboxLight,
  oneDark,
  dracula,
  gruvboxDark,
  nord,
  solarizedDark,
  tokyoNight,
]

/** Get all token keys that every theme must define */
export function getRequiredTokenKeys(): string[] {
  return Object.keys(themes[0].tokens)
}

/** Apply a theme's tokens to a DOM element (typically document.documentElement) */
export function applyTheme(theme: Theme, element: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(theme.tokens)) {
    element.style.setProperty(key, value)
  }
}

/** Find a theme by id, returns undefined if not found */
export function findTheme(id: string): Theme | undefined {
  return themes.find(t => t.id === id)
}
