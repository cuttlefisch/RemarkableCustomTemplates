import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndoRedo } from '../hooks/useUndoRedo'

describe('useUndoRedo', () => {
  it('starts with the initial value', () => {
    const { result } = renderHook(() => useUndoRedo('initial'))
    expect(result.current.value).toBe('initial')
  })

  it('setValue updates value and pushes to undo stack', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.setValue('b'))
    expect(result.current.value).toBe('b')
    expect(result.current.canUndo).toBe(true)
  })

  it('undo restores previous value', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.setValue('b'))
    act(() => result.current.undo())
    expect(result.current.value).toBe('a')
    expect(result.current.canRedo).toBe(true)
  })

  it('redo restores undone value', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.setValue('b'))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.value).toBe('b')
  })

  it('undo does nothing when stack is empty', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.undo())
    expect(result.current.value).toBe('a')
  })

  it('redo does nothing when stack is empty', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.redo())
    expect(result.current.value).toBe('a')
  })

  it('new setValue clears redo stack', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.setValue('b'))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.setValue('c'))
    expect(result.current.canRedo).toBe(false)
  })

  it('supports multiple undo levels', () => {
    const { result } = renderHook(() => useUndoRedo('a'))
    act(() => result.current.setValue('b'))
    act(() => result.current.setValue('c'))
    act(() => result.current.setValue('d'))
    act(() => result.current.undo())
    expect(result.current.value).toBe('c')
    act(() => result.current.undo())
    expect(result.current.value).toBe('b')
    act(() => result.current.undo())
    expect(result.current.value).toBe('a')
  })

  it('limits undo stack to 50 entries', () => {
    const { result } = renderHook(() => useUndoRedo('0'))
    for (let i = 1; i <= 60; i++) {
      act(() => result.current.setValue(String(i)))
    }
    // Should be able to undo 50 times, not 60
    let undoCount = 0
    while (result.current.canUndo) {
      act(() => result.current.undo())
      undoCount++
      if (undoCount > 100) break // safety
    }
    expect(undoCount).toBe(50)
  })
})
