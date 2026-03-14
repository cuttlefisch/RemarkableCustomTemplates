import type { ConstantEntry } from '../types/template'

/** WCAG 2.1 relative luminance (range 0–1) */
export function relativeLuminanceFromHex(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const linearize = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * true when background is significantly darker than foreground:
 *   contrast ratio ≥ 4.5:1  AND  bg luminance < fg luminance
 */
export function isHighContrastDark(bgHex: string, fgHex: string): boolean {
  const bgL = relativeLuminanceFromHex(bgHex)
  const fgL = relativeLuminanceFromHex(fgHex)
  const lighter = Math.max(bgL, fgL)
  const darker = Math.min(bgL, fgL)
  const contrast = (lighter + 0.05) / (darker + 0.05)
  return contrast >= 4.5 && bgL < fgL
}

/** Pull { key: '#xxxxxx' } entries out of the raw constants array */
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
