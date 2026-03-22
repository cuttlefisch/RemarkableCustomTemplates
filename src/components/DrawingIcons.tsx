/**
 * Hand-crafted SVG icon components for the drawing editor toolbar.
 * All icons render at 18×18 viewBox using currentColor for theme compatibility.
 */

const S = 18 // viewBox size

function Icon({ children, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}

// ── Tool Icons ──────────────────────────────────────────────────────────────

/** Arrow cursor */
export function SelectIcon() {
  return (
    <Icon>
      <path d="M4 2 L4 14 L7.5 10.5 L11 15 L13 14 L9.5 9 L14 8 Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

/** Crosshair marker */
export function PointIcon() {
  return (
    <Icon>
      <circle cx={9} cy={9} r={2} />
      <line x1={9} y1={2} x2={9} y2={5} />
      <line x1={9} y1={13} x2={9} y2={16} />
      <line x1={2} y1={9} x2={5} y2={9} />
      <line x1={13} y1={9} x2={16} y2={9} />
    </Icon>
  )
}

/** Diagonal line with endpoint dots */
export function LineIcon() {
  return (
    <Icon>
      <line x1={4} y1={14} x2={14} y2={4} />
      <circle cx={4} cy={14} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={14} cy={4} r={1.5} fill="currentColor" stroke="none" />
    </Icon>
  )
}

/** Pentagon outline */
export function PolygonIcon() {
  return (
    <Icon>
      <polygon points="9,2 16,7 14,15 4,15 2,7" />
    </Icon>
  )
}

/** Hexagon outline */
export function RegularPolygonIcon() {
  return (
    <Icon>
      <polygon points="9,2 15,5.5 15,12.5 9,16 3,12.5 3,5.5" />
    </Icon>
  )
}

/** Circle outline */
export function CircleIcon() {
  return (
    <Icon>
      <circle cx={9} cy={9} r={7} />
    </Icon>
  )
}

/** Pen tool / bezier curve */
export function BezierIcon() {
  return (
    <Icon>
      <path d="M3 14 C3 6, 15 12, 15 4" />
      <circle cx={3} cy={14} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={15} cy={4} r={1.5} fill="currentColor" stroke="none" />
    </Icon>
  )
}

// ── Action Icons ────────────────────────────────────────────────────────────

/** Curved arrow pointing left (undo) */
export function UndoIcon() {
  return (
    <Icon>
      <path d="M4 7 L7 4 M4 7 L7 10" />
      <path d="M4 7 C8 7 13 7 13 12" />
    </Icon>
  )
}

/** Curved arrow pointing right (redo) */
export function RedoIcon() {
  return (
    <Icon>
      <path d="M14 7 L11 4 M14 7 L11 10" />
      <path d="M14 7 C10 7 5 7 5 12" />
    </Icon>
  )
}

/** Trash can */
export function DeleteIcon() {
  return (
    <Icon>
      <path d="M3 5 H15" />
      <path d="M7 5 V3 H11 V5" />
      <path d="M5 5 L6 15 H12 L13 5" />
      <line x1={8} y1={7.5} x2={8} y2={12.5} />
      <line x1={10} y1={7.5} x2={10} y2={12.5} />
    </Icon>
  )
}

// ── Layer Icons ─────────────────────────────────────────────────────────────

/** Send to back (bottom) — stacked rects with down arrow to bar */
export function SendBackIcon() {
  return (
    <Icon>
      <rect x={4} y={3} width={7} height={5} rx={0.5} opacity={0.4} />
      <rect x={7} y={6} width={7} height={5} rx={0.5} />
      <line x1={9} y1={12} x2={9} y2={16} />
      <path d="M7 14.5 L9 16.5 L11 14.5" />
    </Icon>
  )
}

/** Send backward — stacked rects with small down arrow */
export function SendBackwardIcon() {
  return (
    <Icon>
      <rect x={4} y={2} width={7} height={5} rx={0.5} opacity={0.4} />
      <rect x={7} y={5} width={7} height={5} rx={0.5} />
      <line x1={9} y1={11.5} x2={9} y2={15.5} />
      <path d="M7.5 14} L9 15.5 L10.5 14" />
    </Icon>
  )
}

/** Bring forward — stacked rects with small up arrow */
export function BringForwardIcon() {
  return (
    <Icon>
      <rect x={7} y={6} width={7} height={5} rx={0.5} opacity={0.4} />
      <rect x={4} y={3} width={7} height={5} rx={0.5} />
      <line x1={9} y1={11.5} x2={9} y2={15.5} />
      <path d="M7.5 13 L9 11.5 L10.5 13" />
    </Icon>
  )
}

/** Bring to front (top) — stacked rects with up arrow to bar */
export function BringFrontIcon() {
  return (
    <Icon>
      <rect x={7} y={6} width={7} height={5} rx={0.5} opacity={0.4} />
      <rect x={4} y={3} width={7} height={5} rx={0.5} />
      <line x1={9} y1={12} x2={9} y2={16} />
      <path d="M7 13.5 L9 11.5 L11 13.5" />
    </Icon>
  )
}

// ── Zoom Icons ──────────────────────────────────────────────────────────────

/** Magnifying glass with plus */
export function ZoomInIcon() {
  return (
    <Icon>
      <circle cx={8} cy={8} r={5} />
      <line x1={12} y1={12} x2={16} y2={16} />
      <line x1={6} y1={8} x2={10} y2={8} />
      <line x1={8} y1={6} x2={8} y2={10} />
    </Icon>
  )
}

/** Magnifying glass with minus */
export function ZoomOutIcon() {
  return (
    <Icon>
      <circle cx={8} cy={8} r={5} />
      <line x1={12} y1={12} x2={16} y2={16} />
      <line x1={6} y1={8} x2={10} y2={8} />
    </Icon>
  )
}

// ── Transform Icons ──────────────────────────────────────────────────────

/** Flip horizontal — two horizontal arrows with vertical dashed center line */
export function FlipHorizontalIcon() {
  return (
    <Icon>
      <line x1={9} y1={3} x2={9} y2={15} strokeDasharray="2 2" />
      <path d="M6 7 L3 9 L6 11" />
      <path d="M12 7 L15 9 L12 11" />
    </Icon>
  )
}

/** Flip vertical — two vertical arrows with horizontal dashed center line */
export function FlipVerticalIcon() {
  return (
    <Icon>
      <line x1={3} y1={9} x2={15} y2={9} strokeDasharray="2 2" />
      <path d="M7 6 L9 3 L11 6" />
      <path d="M7 12 L9 15 L11 12" />
    </Icon>
  )
}

/** Rotate clockwise — curved arrow CW */
export function RotateCWIcon() {
  return (
    <Icon>
      <path d="M14 5 A6 6 0 1 0 15 10" />
      <path d="M12 3 L14 5 L12 7" />
    </Icon>
  )
}

/** Rotate counter-clockwise — curved arrow CCW */
export function RotateCCWIcon() {
  return (
    <Icon>
      <path d="M4 5 A6 6 0 1 1 3 10" />
      <path d="M6 3 L4 5 L6 7" />
    </Icon>
  )
}

/** Zoom to fit — four corner brackets */
export function ZoomFitIcon() {
  return (
    <Icon>
      <path d="M2 6 V2 H6" />
      <path d="M12 2 H16 V6" />
      <path d="M16 12 V16 H12" />
      <path d="M6 16 H2 V12" />
      <rect x={6} y={6} width={6} height={6} rx={0.5} />
    </Icon>
  )
}
