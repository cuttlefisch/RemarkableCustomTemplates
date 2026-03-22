/**
 * useViewport — reusable zoom/pan hook for template SVG previews.
 *
 * Supports both controlled mode (drawing editor owns state) and
 * uncontrolled mode (hook manages its own state).
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { computeViewBox, zoomAtPoint, clampPan } from '../lib/drawingViewport'
import type { Point } from '../lib/drawingViewport'

export interface UseViewportOptions {
  templateWidth: number
  templateHeight: number
  /** Controlled zoom (optional — omit for uncontrolled mode). */
  zoom?: number
  /** Controlled pan (optional — omit for uncontrolled mode). */
  pan?: Point
  /** Callback when zoom/pan changes in controlled mode. */
  onViewportChange?: (zoom: number, pan: Point) => void
  /** Snap to 1× when zooming out near default. Default true. */
  snapToDefault?: boolean
  /** Which mouse button initiates pan: 'left' (preview) or 'middle' (drawing). Default 'left'. */
  panButton?: 'left' | 'middle'
  /** Set false to disable all interactions. Default true. */
  enabled?: boolean
}

export interface UseViewportResult {
  zoom: number
  pan: Point
  /** SVG viewBox string, or undefined when at default (zoom=1, pan=0,0). */
  viewBox: string | undefined
  isZoomed: boolean
  isPanning: boolean
  containerProps: {
    onMouseDown: (e: React.MouseEvent) => void
    onMouseUp: (e: React.MouseEvent) => void
    onMouseMove: (e: React.MouseEvent) => void
    onMouseLeave: (e: React.MouseEvent) => void
    onWheel: (e: React.WheelEvent) => void
    tabIndex: number
    style: CSSProperties
  }
  resetView: () => void
  svgRef: React.RefObject<SVGSVGElement | null>
}

export function useViewport({
  templateWidth,
  templateHeight,
  zoom: controlledZoom,
  pan: controlledPan,
  onViewportChange,
  snapToDefault = true,
  panButton = 'left',
  enabled = true,
}: UseViewportOptions): UseViewportResult {
  // Uncontrolled state
  const [internalZoom, setInternalZoom] = useState(1)
  const [internalPan, setInternalPan] = useState<Point>({ x: 0, y: 0 })

  // Determine whether we're in controlled mode
  const isControlled = controlledZoom !== undefined && controlledPan !== undefined
  const zoom = isControlled ? controlledZoom : internalZoom
  const pan = isControlled ? controlledPan : internalPan

  const svgRef = useRef<SVGSVGElement | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const lastPanPoint = useRef<Point | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const setViewport = useCallback((newZoom: number, newPan: Point) => {
    if (isControlled) {
      onViewportChange?.(newZoom, newPan)
    } else {
      setInternalZoom(newZoom)
      setInternalPan(newPan)
    }
  }, [isControlled, onViewportChange])

  const resetView = useCallback(() => {
    setViewport(1, { x: 0, y: 0 })
  }, [setViewport])

  // Space key tracking (only for middle-button pan mode)
  useEffect(() => {
    if (!enabled || panButton !== 'middle') return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        setSpaceHeld(false)
        setIsPanning(false)
        lastPanPoint.current = null
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [enabled, panButton])

  const screenToSvg = useCallback((e: { clientX: number; clientY: number }): Point | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const inv = ctm.inverse()
    return {
      x: e.clientX * inv.a + e.clientY * inv.c + inv.e,
      y: e.clientX * inv.b + e.clientY * inv.d + inv.f,
    }
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!enabled) return
    e.preventDefault()
    const cursorPt = screenToSvg(e)
    if (!cursorPt) return

    const delta = e.deltaY > 0 ? -0.15 : 0.15
    const result = zoomAtPoint(zoom, pan, delta, cursorPt, templateWidth, templateHeight)

    // Snap to 1× when zooming out near default
    if (snapToDefault && result.zoom < 1.05 && result.zoom > 0.95 && delta < 0) {
      setViewport(1, { x: 0, y: 0 })
    } else {
      setViewport(result.zoom, result.pan)
    }
  }, [enabled, zoom, pan, templateWidth, templateHeight, snapToDefault, setViewport, screenToSvg])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled) return

    const shouldPan = panButton === 'left'
      ? e.button === 0
      : (e.button === 1 || (spaceHeld && e.button === 0))

    if (!shouldPan) return

    e.preventDefault()
    const pt = screenToSvg(e)
    if (!pt) return
    lastPanPoint.current = pt
    setIsPanning(true)
  }, [enabled, panButton, spaceHeld, screenToSvg])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!enabled || !isPanning || !lastPanPoint.current) return

    const pt = screenToSvg(e)
    if (!pt) return

    const dx = pt.x - lastPanPoint.current.x
    const dy = pt.y - lastPanPoint.current.y
    const newPan = clampPan(
      { x: pan.x + dx, y: pan.y + dy },
      zoom,
      templateWidth,
      templateHeight,
    )
    setViewport(zoom, newPan)
    // Don't update lastPanPoint — the viewBox change adjusts coordinates
  }, [enabled, isPanning, pan, zoom, templateWidth, templateHeight, setViewport, screenToSvg])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      lastPanPoint.current = null
    }
  }, [isPanning])

  const handleMouseLeave = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
      lastPanPoint.current = null
    }
  }, [isPanning])

  // Compute viewBox
  const isZoomed = zoom !== 1 || pan.x !== 0 || pan.y !== 0
  let viewBox: string | undefined
  if (isZoomed) {
    const vb = computeViewBox(templateWidth, templateHeight, zoom, pan)
    viewBox = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
  }

  const cursor = isPanning
    ? 'grabbing'
    : (panButton === 'middle' && spaceHeld)
      ? 'grab'
      : undefined

  return {
    zoom,
    pan,
    viewBox,
    isZoomed,
    isPanning,
    containerProps: {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onWheel: handleWheel,
      tabIndex: 0,
      style: cursor ? { cursor } : {},
    },
    resetView,
    svgRef,
  }
}
