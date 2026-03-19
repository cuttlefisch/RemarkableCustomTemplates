import { describe, it, expect, beforeEach } from 'vitest'
import { themes, getRequiredTokenKeys, applyTheme, findTheme } from '../themes/themes'

describe('Theme system', () => {
  describe('theme definitions', () => {
    const requiredKeys = getRequiredTokenKeys()

    it('has exactly 10 themes', () => {
      expect(themes).toHaveLength(10)
    })

    it('has unique theme ids', () => {
      const ids = themes.map(t => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('includes all expected themes', () => {
      const ids = themes.map(t => t.id)
      expect(ids).toContain('github-light')
      expect(ids).toContain('one-light')
      expect(ids).toContain('solarized-light')
      expect(ids).toContain('gruvbox-light')
      expect(ids).toContain('one-dark')
      expect(ids).toContain('dracula')
      expect(ids).toContain('gruvbox-dark')
      expect(ids).toContain('nord')
      expect(ids).toContain('solarized-dark')
      expect(ids).toContain('tokyo-night')
    })

    for (const theme of themes) {
      describe(`${theme.name} theme`, () => {
        it('has all required token keys', () => {
          const themeKeys = Object.keys(theme.tokens)
          const missing = requiredKeys.filter(k => !themeKeys.includes(k))
          expect(missing).toEqual([])
        })

        it('has no extra token keys beyond required', () => {
          const themeKeys = Object.keys(theme.tokens)
          const extra = themeKeys.filter(k => !requiredKeys.includes(k))
          expect(extra).toEqual([])
        })

        it('has non-empty string values for all tokens', () => {
          for (const [key, value] of Object.entries(theme.tokens)) {
            expect(typeof value).toBe('string')
            expect(value.length, `token ${key} should not be empty`).toBeGreaterThan(0)
          }
        })

        it('has a non-empty id and name', () => {
          expect(theme.id.length).toBeGreaterThan(0)
          expect(theme.name.length).toBeGreaterThan(0)
        })

        it('has a valid group field', () => {
          expect(['light', 'dark']).toContain(theme.group)
        })

        it('has a valid monacoTheme with required fields', () => {
          expect(theme.monacoTheme).toBeDefined()
          expect(theme.monacoTheme.base).toBeDefined()
          expect(theme.monacoTheme.inherit).toBe(true)
          expect(theme.monacoTheme.rules).toBeDefined()
          expect(Array.isArray(theme.monacoTheme.rules)).toBe(true)
          expect(theme.monacoTheme.colors).toBeDefined()
        })

        it('has monacoTheme.base matching group', () => {
          if (theme.group === 'light') {
            expect(theme.monacoTheme.base).toBe('vs')
          } else {
            expect(theme.monacoTheme.base).toBe('vs-dark')
          }
        })

        it('has monacoTheme with editor chrome colors', () => {
          const colors = theme.monacoTheme.colors
          expect(colors['editor.background']).toBeDefined()
          expect(colors['editor.foreground']).toBeDefined()
        })

        it('has monacoTheme with bracket match colors', () => {
          const colors = theme.monacoTheme.colors
          expect(colors['editorBracketMatch.background']).toBeDefined()
          expect(colors['editorBracketMatch.border']).toBeDefined()
        })

        it('uses only hex/hex8 colors in monacoTheme (no rgba)', () => {
          // Monaco defineTheme only parses hex (#rrggbb) and hex8 (#rrggbbaa).
          // rgba() strings silently fail, falling back to base theme defaults.
          const hexPattern = /^#[0-9a-fA-F]{3,8}$/
          for (const [key, value] of Object.entries(theme.monacoTheme.colors)) {
            expect(value, `${theme.id} monacoTheme.colors["${key}"] = "${value}" is not hex`).toMatch(hexPattern)
          }
        })
      })
    }
  })

  describe('applyTheme()', () => {
    let element: HTMLElement

    beforeEach(() => {
      element = document.createElement('div')
    })

    it('sets CSS custom properties on the target element', () => {
      const theme = themes[0]
      applyTheme(theme, element)

      for (const [key, value] of Object.entries(theme.tokens)) {
        expect(element.style.getPropertyValue(key)).toBe(value)
      }
    })

    it('overwrites previous theme properties', () => {
      const [first, second] = themes
      applyTheme(first, element)
      applyTheme(second, element)

      for (const [key, value] of Object.entries(second.tokens)) {
        expect(element.style.getPropertyValue(key)).toBe(value)
      }
    })
  })

  describe('findTheme()', () => {
    it('finds a theme by id', () => {
      const result = findTheme('dracula')
      expect(result).toBeDefined()
      expect(result!.id).toBe('dracula')
    })

    it('returns undefined for unknown id', () => {
      expect(findTheme('nonexistent')).toBeUndefined()
    })

    it('returns undefined for empty string', () => {
      expect(findTheme('')).toBeUndefined()
    })
  })

  describe('localStorage persistence', () => {
    const STORAGE_KEY = 'remarkable-templates-theme'

    beforeEach(() => {
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    })

    it('every theme id can round-trip through findTheme()', () => {
      for (const theme of themes) {
        const found = findTheme(theme.id)
        expect(found).toBeDefined()
        expect(found!.id).toBe(theme.id)
        expect(found!.name).toBe(theme.name)
      }
    })

    it('storage key is consistent', () => {
      expect(STORAGE_KEY).toBe('remarkable-templates-theme')
    })

    it('default theme id (github-light) is a valid theme', () => {
      expect(findTheme('github-light')).toBeDefined()
    })
  })
})
