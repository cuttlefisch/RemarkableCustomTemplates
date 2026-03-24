import { useCallback, useRef } from 'react'

interface ResizeDividerProps {
  /** Called on each mousemove frame with the horizontal pixel delta since last frame. */
  onResize: (deltaX: number) => void
}

/**
 * Draggable vertical divider for resizable panel layouts.
 * Captures the mouse on drag start and reports frame-throttled horizontal deltas
 * via `onResize`. Used between sidebar, canvas, and editor panels.
 */
export function ResizeDivider({ onResize }: ResizeDividerProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)
  const rafId = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    lastX.current = e.clientX
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = ev.clientX - lastX.current
      lastX.current = ev.clientX
      cancelAnimationFrame(rafId.current)
      rafId.current = requestAnimationFrame(() => {
        onResize(delta)
      })
    }

    const handleMouseUp = () => {
      dragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      cancelAnimationFrame(rafId.current)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onResize])

  return (
    <div
      className="resize-divider"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
    />
  )
}
