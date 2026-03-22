import { useState, useEffect, useRef, useCallback } from 'react'

export interface ToolbarGroup {
  id: string
  priority: number // lower = stays visible longer
  render: () => React.ReactNode
}

/**
 * Measures toolbar group widths and hides groups in reverse priority order
 * until all visible groups fit without wrapping.
 */
export function useToolbarOverflow(groups: ToolbarGroup[]) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set())

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Get all group elements and the overflow button
    const groupEls = container.querySelectorAll<HTMLElement>('[data-toolbar-group]')
    const overflowBtn = container.querySelector<HTMLElement>('[data-toolbar-overflow]')
    const separators = container.querySelectorAll<HTMLElement>('.drawing-toolbar-separator')

    // First, show everything to measure
    groupEls.forEach(el => { el.style.display = '' })
    separators.forEach(el => { el.style.display = '' })

    // Measure container available width (content area)
    const containerWidth = container.clientWidth
    // If container has no measurable width (e.g. not yet laid out), skip
    if (containerWidth === 0) {
      setOverflowIds(new Set())
      return
    }
    // Account for padding (12px each side) and gap accumulation
    const containerPadding = 24

    // Measure all group widths
    const groupWidths: { id: string; priority: number; width: number }[] = []
    groupEls.forEach(el => {
      const id = el.getAttribute('data-toolbar-group')!
      const group = groups.find(g => g.id === id)
      if (!group) return
      groupWidths.push({
        id,
        priority: group.priority,
        width: el.getBoundingClientRect().width,
      })
    })

    // Measure separator width (typically 1px + 6px gap each side = ~13px)
    const sepWidth = separators.length > 0 ? separators[0].getBoundingClientRect().width + 6 : 7
    const overflowBtnWidth = overflowBtn ? overflowBtn.getBoundingClientRect().width + 6 : 34

    // Calculate total width of all groups + separators between them
    const totalGroupWidth = groupWidths.reduce((sum, g) => sum + g.width, 0)
    const totalSepWidth = Math.max(0, groupWidths.length - 1) * sepWidth
    const totalWidth = totalGroupWidth + totalSepWidth + containerPadding

    if (totalWidth <= containerWidth) {
      // Everything fits
      setOverflowIds(new Set())
      return
    }

    // Need to hide groups. Sort by priority descending (highest priority number hidden first)
    const sortedByPriority = [...groupWidths].sort((a, b) => b.priority - a.priority)

    let currentWidth = totalWidth + overflowBtnWidth
    const hidden = new Set<string>()

    for (const group of sortedByPriority) {
      if (currentWidth <= containerWidth) break
      hidden.add(group.id)
      currentWidth -= group.width + sepWidth
    }

    setOverflowIds(hidden)
  }, [groups])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(recalculate)
    })
    observer.observe(container)

    // ResizeObserver fires immediately upon observe() for the initial size,
    // so no need to call recalculate() synchronously here.

    return () => observer.disconnect()
  }, [recalculate])

  return { containerRef, overflowIds, recalculate }
}
