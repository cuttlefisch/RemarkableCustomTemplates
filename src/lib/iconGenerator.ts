/// <reference types="node" />
/**
 * Generate a base64-encoded SVG icon for a reMarkable template.
 *
 * The SVG uses the device pixel coordinate space as its viewBox so all path
 * coordinates work unchanged, then scales to icon dimensions (150×200 portrait
 * or 200×150 landscape) via the width/height attributes.
 */

import type { RemarkableTemplate, TemplateItem, GroupItem, PathItem } from '../types/template'
import {
  computeTileRange,
  pathDataToSvgD,
  resolveScalar,
  deviceBuiltins,
  formatNum,
  REPEAT_KEYWORDS,
  type DeviceId,
  type ResolvedConstants,
} from './renderer'
import { resolveConstants, evaluateExpression } from './expression'
import { extractColorConstants } from './color'
import type { RepeatValue } from '../types/template'

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function resolveRepeat(value: RepeatValue, constants: ResolvedConstants): RepeatValue {
  if (typeof value === 'number') return value
  if (REPEAT_KEYWORDS.has(value)) return value
  return evaluateExpression(value, constants)
}

function resolveColor(value: string | undefined, colorConstants: Record<string, string>, fallback: string): string {
  if (!value) return fallback
  if (value.startsWith('#')) return value
  return colorConstants[value] ?? fallback
}

/**
 * Build a minimal SVG string rendering the template, then return it as a
 * base64 string (suitable for embedding in the `iconData` field).
 */
export function generateTemplateIcon(template: RemarkableTemplate, deviceId: DeviceId = 'rm'): string {
  const builtins = deviceBuiltins(template.orientation, deviceId)
  const constants = resolveConstants(template.constants, builtins)
  const { templateWidth, templateHeight } = builtins
  const colorConstants = extractColorConstants(template.constants)
  const isDark = template.categories.includes('Dark')
  const bgColor = colorConstants['background'] ?? (isDark ? '#000000' : '#ffffff')

  const iconW = template.orientation === 'portrait' ? 150 : 200
  const iconH = template.orientation === 'portrait' ? 200 : 150

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` viewBox="0 0 ${templateWidth} ${templateHeight}"` +
    ` width="${iconW}" height="${iconH}">`,
  )
  parts.push(`<rect width="${templateWidth}" height="${templateHeight}" fill="${escapeAttr(bgColor)}"/>`)

  function renderItems(items: TemplateItem[], ctx: ResolvedConstants): void {
    for (const item of items) renderItem(item, ctx)
  }

  function renderItem(item: TemplateItem, ctx: ResolvedConstants): void {
    if (item.type === 'path') renderPath(item, ctx)
    else if (item.type === 'group') renderGroup(item, ctx)
    // text: skip — icons don't need text for visual clarity
  }

  function renderPath(item: PathItem, ctx: ResolvedConstants): void {
    const d = pathDataToSvgD(item.data, ctx)
    const stroke = resolveColor(item.strokeColor, colorConstants, '#000000')
    const fill = resolveColor(item.fillColor, colorConstants, 'none')
    const sw = formatNum(resolveScalar(item.strokeWidth ?? 1, ctx))
    parts.push(`<path d="${escapeAttr(d)}" stroke="${escapeAttr(stroke)}" fill="${escapeAttr(fill)}" stroke-width="${sw}"/>`)
  }

  function renderGroup(item: GroupItem, ctx: ResolvedConstants): void {
    const x = resolveScalar(item.boundingBox.x, ctx)
    const y = resolveScalar(item.boundingBox.y, ctx)
    const w = resolveScalar(item.boundingBox.width, ctx)
    const h = resolveScalar(item.boundingBox.height, ctx)

    const rows    = resolveRepeat(item.repeat?.rows    ?? 0, ctx)
    const columns = resolveRepeat(item.repeat?.columns ?? 0, ctx)

    const rowRange = computeTileRange(y, h, templateHeight, rows)
    const colRange = computeTileRange(x, w, templateWidth,  columns)

    const childCtx: ResolvedConstants = { ...ctx, parentWidth: w, parentHeight: h }

    for (let r = rowRange.start; r < rowRange.start + rowRange.count; r++) {
      for (let c = colRange.start; c < colRange.start + colRange.count; c++) {
        const tx = formatNum(x + c * w)
        const ty = formatNum(y + r * h)
        parts.push(`<g transform="translate(${tx},${ty})">`)
        renderItems(item.children, childCtx)
        parts.push('</g>')
      }
    }
  }

  renderItems(template.items, constants)
  parts.push('</svg>')

  return Buffer.from(parts.join('')).toString('base64')
}
