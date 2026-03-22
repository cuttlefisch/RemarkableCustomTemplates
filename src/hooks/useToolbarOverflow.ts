import { useState, useEffect, useRef, useCallback } from 'react'

export interface ToolbarGroup {
  id: string
  priority: number // lower = stays visible longer
  render: () => React.ReactNode
}

/**
 * Measures toolbar group widths and hides groups in reverse priority order
 * until all visible groups fit without wrapping.
 *
 * All groups must always be rendered in the DOM (hidden ones with display:none)
 * so this hook can temporarily unhide them for measurement.
 */
export function useToolbarOverflow(groups: ToolbarGroup[]) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set())
  const groupsRef = useRef(groups)
  useEffect(() => { groupsRef.current = groups })

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const groupEls = container.querySelectorAll<HTMLElement>('[data-toolbar-group]')
    const overflowBtn = container.querySelector<HTMLElement>('[data-toolbar-overflow]')

    // Temporarily show all groups to measure their natural widths
    const savedDisplays: string[] = []
    groupEls.forEach((el, i) => {
      savedDisplays[i] = el.style.display
      el.style.display = ''
    })

    const containerWidth = container.clientWidth
    if (containerWidth === 0) {
      // Restore and bail
      groupEls.forEach((el, i) => { el.style.display = savedDisplays[i] })
      return
    }

    // 12px padding each side
    const containerPadding = 24
    // Measure gap between groups (from CSS gap)
    const gap = 6
    const overflowBtnWidth = overflowBtn ? overflowBtn.getBoundingClientRect().width + gap : 34

    // Measure all group widths
    const currentGroups = groupsRef.current
    const groupWidths: { id: string; priority: number; width: number }[] = []
    groupEls.forEach(el => {
      const id = el.getAttribute('data-toolbar-group')!
      const group = currentGroups.find(g => g.id === id)
      if (!group) return
      groupWidths.push({
        id,
        priority: group.priority,
        width: el.getBoundingClientRect().width,
      })
    })

    // Restore original display values
    groupEls.forEach((el, i) => { el.style.display = savedDisplays[i] })

    // Calculate total width: groups + gaps between visible groups + padding
    const totalGroupWidth = groupWidths.reduce((sum, g) => sum + g.width, 0)
    const totalGaps = Math.max(0, groupWidths.length - 1) * gap
    const totalWidth = totalGroupWidth + totalGaps + containerPadding

    let hidden: Set<string>

    if (totalWidth <= containerWidth) {
      hidden = new Set()
    } else {
      // Sort by priority descending (highest priority number hidden first)
      const sortedByPriority = [...groupWidths].sort((a, b) => b.priority - a.priority)
      let currentWidth = totalWidth + overflowBtnWidth
      hidden = new Set<string>()

      for (const group of sortedByPriority) {
        if (currentWidth <= containerWidth) break
        hidden.add(group.id)
        currentWidth -= group.width + gap
      }
    }

    // Only update state if the set actually changed (prevents render loops)
    setOverflowIds(prev => {
      if (prev.size !== hidden.size) return hidden
      for (const id of hidden) {
        if (!prev.has(id)) return hidden
      }
      return prev
    })
  }, []) // stable — reads groups from ref

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(recalculate)
    })
    observer.observe(container)
    const rafId = requestAnimationFrame(recalculate)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [recalculate])

  // Recalculate when group definitions change (tool switch adds/removes options)
  const prevGroupIdsRef = useRef('')
  useEffect(() => {
    const ids = groups.map(g => g.id).join(',')
    if (ids !== prevGroupIdsRef.current) {
      prevGroupIdsRef.current = ids
      requestAnimationFrame(recalculate)
    }
  })

  return { containerRef, overflowIds, recalculate }
}
