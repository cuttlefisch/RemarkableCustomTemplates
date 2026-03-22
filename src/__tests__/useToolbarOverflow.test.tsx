import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToolbarOverflow, type ToolbarGroup } from '../hooks/useToolbarOverflow'

// ── Mock ResizeObserver ──────────────────────────────────────────────────────

let resizeCallbacks: ResizeObserverCallback[] = []

beforeAll(() => {
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) {
      resizeCallbacks.push(cb)
    }
    observe() {}
    unobserve() {}
    disconnect() {
      resizeCallbacks = resizeCallbacks.filter(cb => cb !== (this as unknown as { _cb: ResizeObserverCallback })._cb)
    }
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  resizeCallbacks = []
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGroups(count: number): ToolbarGroup[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `group-${i}`,
    priority: i,
    render: () => null,
  }))
}

/** Build a mock container element with controllable width and mock group elements */
function mockContainer(containerWidth: number, groupWidths: Map<string, number>) {
  const groupEls: HTMLElement[] = []
  for (const [id, width] of groupWidths) {
    const el = document.createElement('div')
    el.setAttribute('data-toolbar-group', id)
    el.getBoundingClientRect = () => ({ width, height: 32, x: 0, y: 0, top: 0, left: 0, bottom: 32, right: width, toJSON: () => ({}) })
    groupEls.push(el)
  }

  const overflowBtn = document.createElement('button')
  overflowBtn.setAttribute('data-toolbar-overflow', '')
  overflowBtn.getBoundingClientRect = () => ({ width: 28, height: 32, x: 0, y: 0, top: 0, left: 0, bottom: 32, right: 28, toJSON: () => ({}) })

  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: containerWidth, configurable: true })
  container.querySelectorAll = ((selector: string) => {
    if (selector === '[data-toolbar-group]') return groupEls
    if (selector === '[data-toolbar-overflow]') return [overflowBtn]
    if (selector === '.drawing-toolbar-separator') return []
    return []
  }) as unknown as typeof container.querySelectorAll
  container.querySelector = ((selector: string) => {
    if (selector === '[data-toolbar-overflow]') return overflowBtn
    return null
  }) as unknown as typeof container.querySelector

  return container
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useToolbarOverflow', () => {
  it('returns empty overflowIds initially', () => {
    const groups = makeGroups(3)
    const { result } = renderHook(() => useToolbarOverflow(groups))
    expect(result.current.overflowIds.size).toBe(0)
  })

  it('hides highest-priority groups first when container is narrow', () => {
    const groups: ToolbarGroup[] = [
      { id: 'a', priority: 0, render: () => null },
      { id: 'b', priority: 1, render: () => null },
      { id: 'c', priority: 2, render: () => null },
    ]

    const groupWidths = new Map([['a', 100], ['b', 100], ['c', 100]])
    // Container too narrow for all 3 groups (300 + 24 padding + 12 gaps = 336 > 200)
    const container = mockContainer(200, groupWidths)

    const { result } = renderHook(() => useToolbarOverflow(groups))

    // Assign mock container to the ref
    act(() => {
      Object.assign(result.current.containerRef, { current: container })
      result.current.recalculate()
    })

    // Priority 2 (highest) should be hidden first, then priority 1
    expect(result.current.overflowIds.has('c')).toBe(true)
    expect(result.current.overflowIds.has('a')).toBe(false)
  })

  it('shows all groups when container is wide enough', () => {
    const groups: ToolbarGroup[] = [
      { id: 'a', priority: 0, render: () => null },
      { id: 'b', priority: 1, render: () => null },
    ]

    const groupWidths = new Map([['a', 50], ['b', 50]])
    const container = mockContainer(1000, groupWidths)

    const { result } = renderHook(() => useToolbarOverflow(groups))

    act(() => {
      Object.assign(result.current.containerRef, { current: container })
      result.current.recalculate()
    })

    expect(result.current.overflowIds.size).toBe(0)
  })

  it('handles zero-width container without crashing', () => {
    const groups = makeGroups(2)
    const container = mockContainer(0, new Map([['group-0', 50], ['group-1', 50]]))

    const { result } = renderHook(() => useToolbarOverflow(groups))

    act(() => {
      Object.assign(result.current.containerRef, { current: container })
      result.current.recalculate()
    })

    // Should not crash, overflowIds should remain unchanged
    expect(result.current.overflowIds.size).toBe(0)
  })

  it('set-equality guard prevents re-renders when result unchanged', () => {
    const groups: ToolbarGroup[] = [
      { id: 'a', priority: 0, render: () => null },
      { id: 'b', priority: 1, render: () => null },
    ]

    const groupWidths = new Map([['a', 100], ['b', 100]])
    const container = mockContainer(150, groupWidths)

    const { result } = renderHook(() => useToolbarOverflow(groups))

    act(() => {
      Object.assign(result.current.containerRef, { current: container })
      result.current.recalculate()
    })

    const firstOverflow = result.current.overflowIds

    // Recalculate again with same result
    act(() => {
      result.current.recalculate()
    })

    // Should be the exact same Set reference (no unnecessary state update)
    expect(result.current.overflowIds).toBe(firstOverflow)
  })

  it('exposes recalculate function for manual triggering', () => {
    const groups = makeGroups(1)
    const { result } = renderHook(() => useToolbarOverflow(groups))
    expect(typeof result.current.recalculate).toBe('function')
  })
})
