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
} from '../types/template'
import {
  deviceBuiltins,
  pathDataToSvgD,
  estimateTextWidth,
  resolveScalar,
  computeTileRange,
  formatNum,
  type ResolvedConstants,
} from '../lib/renderer'
import { resolveConstants, evaluateExpression } from '../lib/expression'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateCanvasProps {
  template: RemarkableTemplate
  /** Optional CSS class applied to the root <svg> element. */
  className?: string
}

// ─── Root component ───────────────────────────────────────────────────────────

export function TemplateCanvas({ template, className }: TemplateCanvasProps): ReactElement {
  const builtins = deviceBuiltins(template.orientation)
  const constants = resolveConstants(template.constants, builtins)
  const { templateWidth, templateHeight } = builtins

  return (
    <svg
      viewBox={`0 0 ${templateWidth} ${templateHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width={templateWidth} height={templateHeight} fill="white" />
      {template.items.map((item, i) => (
        <ItemView key={item.id ?? i} item={item} constants={constants} />
      ))}
    </svg>
  )
}

// ─── Item dispatcher ──────────────────────────────────────────────────────────

interface ItemViewProps {
  item: TemplateItem
  constants: ResolvedConstants
}

function ItemView({ item, constants }: ItemViewProps): ReactElement | null {
  switch (item.type) {
    case 'path':  return <PathView  item={item} constants={constants} />
    case 'text':  return <TextView  item={item} constants={constants} />
    case 'group': return <GroupView item={item} constants={constants} />
  }
}

// ─── Path ─────────────────────────────────────────────────────────────────────

function PathView({ item, constants }: { item: PathItem; constants: ResolvedConstants }) {
  const d = pathDataToSvgD(item.data, constants)
  const strokeWidth = resolveScalar(item.strokeWidth ?? 1, constants)

  return (
    <path
      id={item.id}
      d={d}
      stroke={item.strokeColor ?? '#000000'}
      fill={item.fillColor ?? 'none'}
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

// ─── Group ────────────────────────────────────────────────────────────────────

function GroupView({ item, constants }: { item: GroupItem; constants: ResolvedConstants }) {
  const x = resolveScalar(item.boundingBox.x, constants)
  const y = resolveScalar(item.boundingBox.y, constants)
  const w = resolveScalar(item.boundingBox.width, constants)
  const h = resolveScalar(item.boundingBox.height, constants)

  const rows    = item.repeat?.rows    ?? 0
  const columns = item.repeat?.columns ?? 0

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
            <ItemView key={child.id ?? i} item={child} constants={childConstants} />
          ))}
        </g>,
      )
    }
  }

  return <>{tiles}</>
}
