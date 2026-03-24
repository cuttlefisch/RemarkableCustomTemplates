import type { ConstantEntry } from '../types/template'

/**
 * Compute WCAG 2.1 relative luminance from a hex color string.
 *
 * @param hex - A 7-character hex color string (e.g. `"#1a2b3c"`)
 * @returns Relative luminance in the range [0, 1] (0 = black, 1 = white)
 */
export function relativeLuminanceFromHex(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Determine if a color pair represents a high-contrast dark theme.
 *
 * Returns `true` when the background is significantly darker than the foreground:
 * WCAG contrast ratio >= 4.5:1 AND background luminance < foreground luminance.
 *
 * @param bgHex - Background color as a hex string
 * @param fgHex - Foreground color as a hex string
 * @returns Whether the pair qualifies as a high-contrast dark theme
 */
export function isHighContrastDark(bgHex: string, fgHex: string): boolean {
  const bgL = relativeLuminanceFromHex(bgHex)
  const fgL = relativeLuminanceFromHex(fgHex)
  const lighter = Math.max(bgL, fgL)
  const darker = Math.min(bgL, fgL)
  const contrast = (lighter + 0.05) / (darker + 0.05)
  return contrast >= 4.5 && bgL < fgL
}

/**
 * Extract hex color constants from a template's constants array.
 *
 * Only entries whose values start with `#` are included.
 *
 * @param constants - The template's constants array
 * @returns A map of constant names to hex color strings
 */
export function extractColorConstants(constants: ConstantEntry[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const entry of constants) {
    for (const [key, value] of Object.entries(entry)) {
      if (typeof value === 'string' && value.startsWith('#')) {
        result[key] = value
      }
    }
  }
  return result
}
