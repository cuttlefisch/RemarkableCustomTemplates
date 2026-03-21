/**
 * TemplateViewport — reusable zoomable/pannable template preview wrapper.
 *
 * Composes the useViewport hook with TemplateCanvas. Supports both
 * controlled mode (drawing editor) and uncontrolled mode (preview).
 */

import type { ReactNode } from 'react'
import { TemplateCanvas } from './TemplateCanvas'
import { useViewport } from '../hooks/useViewport'
import { deviceBuiltins, type DeviceId } from '../lib/renderer'
import type { RemarkableTemplate } from '../types/template'
import type { Point } from '../lib/drawingViewport'

export interface TemplateViewportProps {
  template: RemarkableTemplate
  deviceId?: DeviceId
  className?: string
  /** Controlled zoom (optional). */
  zoom?: number
  /** Controlled pan (optional). */
  pan?: Point
  /** Callback when zoom/pan changes in controlled mode. */
  onViewportChange?: (zoom: number, pan: Point) => void
  /** Which mouse button pans: 'left' (preview) or 'middle' (drawing). Default 'left'. */
  panButton?: 'left' | 'middle'
  /** Snap to 1× when zooming out near default. Default true. */
  snapToDefault?: boolean
  /** Set false for static thumbnails. Default true. */
  interactive?: boolean
  /** Pass-through children (e.g. DrawingOverlay). */
  children?: ReactNode
}

export function TemplateViewport({
  template,
  deviceId = 'rm',
  className,
  zoom,
  pan,
  onViewportChange,
  panButton = 'left',
  snapToDefault = true,
  interactive = true,
  children,
}: TemplateViewportProps) {
  const builtins = deviceBuiltins(template.orientation, deviceId)

  const {
    isZoomed,
    viewBox,
    containerProps,
    svgRef,
  } = useViewport({
    templateWidth: builtins.templateWidth,
    templateHeight: builtins.templateHeight,
    zoom,
    pan,
    onViewportChange,
    panButton,
    snapToDefault,
    enabled: interactive,
  })

  const classes = [
    'viewport-stage',
    isZoomed ? 'viewport-zoomed' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} {...(interactive ? containerProps : {})}>
      <TemplateCanvas
        ref={svgRef}
        template={template}
        deviceId={deviceId}
        className="viewport-svg"
        viewBox={viewBox}
      >
        {children}
      </TemplateCanvas>
    </div>
  )
}
