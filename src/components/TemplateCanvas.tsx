/**
 * TemplateCanvas — renders a reMarkable template as an SVG element.
 *
 * The component resolves all constant expressions, tiles repeated groups, and
 * recursively renders the item tree into React SVG elements.
 */

import type { ReactElement } from 'react'
import type {
  RemarkableTemplate,
  TemplateItem,
  GroupItem,
  PathItem,
  TextItem,
  RepeatValue,
} from '../types/template'
import {
  deviceBuiltins,
  pathDataToSvgD,
  estimateTextWidth,
  resolveScalar,
  computeTileRange,
  formatNum,
  REPEAT_KEYWORDS,
  type DeviceId,
  type ResolvedConstants,
} from '../lib/renderer'
import { resolveConstants, evaluateExpression } from '../lib/expression'
import { extractColorConstants } from '../lib/color'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateCanvasProps {
  template: RemarkableTemplate
  /** Optional CSS class applied to the root <svg> element. */
  className?: string
  /** Device to render for. Defaults to 'rm'. */
  deviceId?: DeviceId
}

// ─── Root component ───────────────────────────────────────────────────────────

export function TemplateCanvas({ template, className, deviceId = 'rm' }: TemplateCanvasProps): ReactElement {
  const builtins = deviceBuiltins(template.orientation, deviceId)
  const constants = resolveConstants(template.constants, builtins)
  const { templateWidth, templateHeight } = builtins
  const isDark = template.categories.includes('Dark')
  const colorConstants = extractColorConstants(template.constants)

  return (
    <svg
      viewBox={`0 0 ${templateWidth} ${templateHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ aspectRatio: `${templateWidth} / ${templateHeight}` }}
    >
      <rect width={templateWidth} height={templateHeight} fill={colorConstants['background'] ?? (isDark ? '#000000' : '#ffffff')} />
      {template.items.map((item, i) => (
        <ItemView key={item.id ?? i} item={item} constants={constants} colorConstants={colorConstants} />
      ))}
    </svg>
  )
}

// ─── Item dispatcher ──────────────────────────────────────────────────────────

interface ItemViewProps {
  item: TemplateItem
  constants: ResolvedConstants
  colorConstants: Record<string, string>
}

function ItemView({ item, constants, colorConstants }: ItemViewProps): ReactElement | null {
  switch (item.type) {
    case 'path':  return <PathView  item={item} constants={constants} colorConstants={colorConstants} />
    case 'text':  return <TextView  item={item} constants={constants} />
    case 'group': return <GroupView item={item} constants={constants} colorConstants={colorConstants} />
  }
}

// ─── Path ─────────────────────────────────────────────────────────────────────

/** Resolve a color value: hex strings pass through; constant names are looked up. */
function resolveColor(value: string | undefined, colorConstants: Record<string, string>, fallback: string): string {
  if (!value) return fallback
  if (value.startsWith('#')) return value
  return colorConstants[value] ?? fallback
}

function PathView({ item, constants, colorConstants }: { item: PathItem; constants: ResolvedConstants; colorConstants: Record<string, string> }) {
  const d = pathDataToSvgD(item.data, constants)
  const strokeWidth = resolveScalar(item.strokeWidth ?? 1, constants)

  return (
    <path
      id={item.id}
      d={d}
      stroke={resolveColor(item.strokeColor, colorConstants, '#000000')}
      fill={resolveColor(item.fillColor, colorConstants, 'none')}
      strokeWidth={strokeWidth}
    />
  )
}

// ─── Text ─────────────────────────────────────────────────────────────────────

function TextView({ item, constants }: { item: TextItem; constants: ResolvedConstants }) {
  const fontSize = evaluateExpression(item.fontSize, constants)
  const textWidth = estimateTextWidth(item.text, fontSize)
  const ctx: ResolvedConstants = { ...constants, textWidth }

  const x = resolveScalar(item.position.x, ctx)
  const y = resolveScalar(item.position.y, ctx)

  return (
    <text id={item.id} x={formatNum(x)} y={formatNum(y)} fontSize={formatNum(fontSize)}>
      {item.text}
    </text>
  )
}

// ─── Repeat resolution ────────────────────────────────────────────────────────

/**
 * Resolve a repeat value to either a keyword string or a number.
 * Named constant expressions like "columns" are evaluated against the current
 * constants map; keyword strings ('down', 'infinite', 'up') pass through as-is.
 */
function resolveRepeat(value: RepeatValue, constants: ResolvedConstants): RepeatValue {
  if (typeof value === 'number') return value
  if (REPEAT_KEYWORDS.has(value)) return value
  return evaluateExpression(value, constants)
}

// ─── Group ────────────────────────────────────────────────────────────────────

function GroupView({ item, constants, colorConstants }: { item: GroupItem; constants: ResolvedConstants; colorConstants: Record<string, string> }) {
  const x = resolveScalar(item.boundingBox.x, constants)
  const y = resolveScalar(item.boundingBox.y, constants)
  const w = resolveScalar(item.boundingBox.width, constants)
  const h = resolveScalar(item.boundingBox.height, constants)

  const rows    = resolveRepeat(item.repeat?.rows    ?? 0, constants)
  const columns = resolveRepeat(item.repeat?.columns ?? 0, constants)

  const { templateWidth, templateHeight } = constants
  const rowRange = computeTileRange(y, h, templateHeight, rows)
  const colRange = computeTileRange(x, w, templateWidth,  columns)

  // Expose tile dimensions to children as parentWidth / parentHeight
  const childConstants: ResolvedConstants = { ...constants, parentWidth: w, parentHeight: h }

  const tiles: ReactElement[] = []
  for (let r = rowRange.start; r < rowRange.start + rowRange.count; r++) {
    for (let c = colRange.start; c < colRange.start + colRange.count; c++) {
      const tx = x + c * w
      const ty = y + r * h
      const key = `${item.id ?? 'g'}-r${r}-c${c}`
      tiles.push(
        <g key={key} transform={`translate(${formatNum(tx)}, ${formatNum(ty)})`}>
          {item.children.map((child, i) => (
            <ItemView key={child.id ?? i} item={child} constants={childConstants} colorConstants={colorConstants} />
          ))}
        </g>,
      )
    }
  }

  return <>{tiles}</>
}
