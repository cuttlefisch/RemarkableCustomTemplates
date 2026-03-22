/**
 * SVG icon components for the notebook builder.
 * All icons render at 18x18 viewBox using currentColor for theme compatibility.
 */

const S = 18

function Icon({ children, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}

/** Back arrow */
export function BackIcon() {
  return (
    <Icon>
      <path d="M11 4 L5 9 L11 14" />
      <line x1={5} y1={9} x2={14} y2={9} />
    </Icon>
  )
}

/** Plus in circle — new / add */
export function PlusIcon() {
  return (
    <Icon>
      <circle cx={9} cy={9} r={7} />
      <line x1={9} y1={6} x2={9} y2={12} />
      <line x1={6} y1={9} x2={12} y2={9} />
    </Icon>
  )
}

/** Notebook / document stack */
export function NotebookIcon() {
  return (
    <Icon>
      <rect x={4} y={2} width={10} height={14} rx={1} />
      <line x1={7} y1={5} x2={11} y2={5} />
      <line x1={7} y1={8} x2={11} y2={8} />
      <line x1={7} y1={11} x2={9} y2={11} />
    </Icon>
  )
}

/** Download arrow — export */
export function ExportIcon() {
  return (
    <Icon>
      <path d="M9 3 L9 11" />
      <path d="M5.5 8 L9 11.5 L12.5 8" />
      <path d="M3 13 L3 15 L15 15 L15 13" />
    </Icon>
  )
}

/** Upload arrow to device — deploy */
export function DeployIcon() {
  return (
    <Icon>
      <path d="M9 12 L9 4" />
      <path d="M5.5 7 L9 3.5 L12.5 7" />
      <path d="M3 13 L3 15 L15 15 L15 13" />
    </Icon>
  )
}

/** Trash can — delete */
export function TrashIcon() {
  return (
    <Icon>
      <path d="M3 5 L15 5" />
      <path d="M7 5 L7 3 L11 3 L11 5" />
      <path d="M5 5 L6 15 L12 15 L13 5" />
      <line x1={8} y1={7.5} x2={8} y2={12.5} />
      <line x1={10} y1={7.5} x2={10} y2={12.5} />
    </Icon>
  )
}

/** Grip dots — drag handle */
export function GripIcon() {
  return (
    <Icon>
      <circle cx={7} cy={5} r={1} fill="currentColor" stroke="none" />
      <circle cx={11} cy={5} r={1} fill="currentColor" stroke="none" />
      <circle cx={7} cy={9} r={1} fill="currentColor" stroke="none" />
      <circle cx={11} cy={9} r={1} fill="currentColor" stroke="none" />
      <circle cx={7} cy={13} r={1} fill="currentColor" stroke="none" />
      <circle cx={11} cy={13} r={1} fill="currentColor" stroke="none" />
    </Icon>
  )
}

/** Page count / stack of pages */
export function PagesIcon() {
  return (
    <Icon>
      <rect x={5} y={4} width={9} height={12} rx={1} />
      <path d="M7 4 L7 2 L14 2 L14 14 L14 14" />
    </Icon>
  )
}

/** Search magnifying glass */
export function SearchIcon() {
  return (
    <Icon>
      <circle cx={8} cy={8} r={5} />
      <line x1={11.5} y1={11.5} x2={15} y2={15} />
    </Icon>
  )
}

/** Fork / copy — duplicate */
export function ForkIcon() {
  return (
    <Icon>
      <rect x={3} y={5} width={8} height={10} rx={1} />
      <path d="M7 5 L7 3 L15 3 L15 13 L11 13" />
    </Icon>
  )
}

/** Warning triangle — overwrite confirmation */
export function WarningIcon() {
  return (
    <Icon>
      <path d="M9 2 L1 16 L17 16 Z" fill="none" />
      <line x1={9} y1={7} x2={9} y2={11} />
      <circle cx={9} cy={13.5} r={0.8} fill="currentColor" stroke="none" />
    </Icon>
  )
}
