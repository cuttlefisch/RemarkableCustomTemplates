/**
 * Generic undo/redo hook operating on string values.
 *
 * Maintains a history stack of up to MAX_ENTRIES items.
 * Works for both drawing commits and manual JSON edits.
 */

import { useState, useCallback, useRef } from 'react'

const MAX_ENTRIES = 50

export function useUndoRedo(initial: string) {
  const [value, setValueInternal] = useState(initial)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  // Track lengths in state so canUndo/canRedo trigger re-renders
  const [undoLen, setUndoLen] = useState(0)
  const [redoLen, setRedoLen] = useState(0)

  const setValue = useCallback((newValue: string) => {
    setValueInternal(prev => {
      if (prev === newValue) return prev
      undoStack.current.push(prev)
      if (undoStack.current.length > MAX_ENTRIES) {
        undoStack.current.shift()
      }
      redoStack.current = []
      setUndoLen(undoStack.current.length)
      setRedoLen(0)
      return newValue
    })
  }, [])

  const undo = useCallback(() => {
    setValueInternal(prev => {
      if (undoStack.current.length === 0) return prev
      redoStack.current.push(prev)
      const val = undoStack.current.pop()!
      setUndoLen(undoStack.current.length)
      setRedoLen(redoStack.current.length)
      return val
    })
  }, [])

  const redo = useCallback(() => {
    setValueInternal(prev => {
      if (redoStack.current.length === 0) return prev
      undoStack.current.push(prev)
      const val = redoStack.current.pop()!
      setUndoLen(undoStack.current.length)
      setRedoLen(redoStack.current.length)
      return val
    })
  }, [])

  return {
    value,
    setValue,
    undo,
    redo,
    canUndo: undoLen > 0,
    canRedo: redoLen > 0,
  }
}
