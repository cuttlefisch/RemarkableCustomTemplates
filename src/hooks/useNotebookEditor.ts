/**
 * State management for the notebook builder.
 * Uses useReducer with a typed action discriminated union.
 */

import { useReducer, useEffect, useRef } from 'react'
import type { PageGroup } from '../types/notebook'
import { getPreferredDeviceType, type DeviceId } from '../lib/renderer'
import type { NotebookDraft } from './useNotebookList'

/** State of the notebook editor — tracks name, page groups, device, and selection. */
export interface NotebookEditorState {
  id: string
  name: string
  pageGroups: PageGroup[]
  selectedGroupIndex: number | null
  deviceId: DeviceId
  orientation: 'portrait' | 'landscape'
  deployedUuid?: string
}

/** Discriminated union of notebook editor actions. Discriminant field: `type`. */
export type NotebookEditorAction =
  | { type: 'SET_NAME'; name: string }
  | { type: 'ADD_GROUP'; group: PageGroup }
  | { type: 'REMOVE_GROUP'; index: number }
  | { type: 'SET_GROUP_COUNT'; index: number; count: number }
  | { type: 'REORDER_GROUP'; fromIndex: number; toIndex: number }
  | { type: 'SELECT_GROUP'; index: number | null }
  | { type: 'SET_DEVICE_ID'; deviceId: DeviceId }
  | { type: 'SET_GROUP_TEMPLATE'; index: number; templateRef: string; templateName: string; iconData?: string }
  | { type: 'SET_ORIENTATION'; orientation: 'portrait' | 'landscape' }
  | { type: 'SET_DEPLOYED_UUID'; deployedUuid: string }
  | { type: 'LOAD'; draft: NotebookDraft }
  | { type: 'RESET' }

/** Default initial state for the notebook editor (empty, portrait, rm device). */
export const initialNotebookEditorState: NotebookEditorState = {
  id: '',
  name: '',
  pageGroups: [],
  selectedGroupIndex: null,
  deviceId: 'rm',
  orientation: 'portrait',
}

/** Pure reducer for notebook editor state — handles page group CRUD, reordering, and draft loading. */
export function notebookEditorReducer(
  state: NotebookEditorState,
  action: NotebookEditorAction,
): NotebookEditorState {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.name }

    case 'ADD_GROUP':
      return {
        ...state,
        pageGroups: [...state.pageGroups, action.group],
        selectedGroupIndex: state.pageGroups.length,
      }

    case 'REMOVE_GROUP': {
      const newGroups = state.pageGroups.filter((_, i) => i !== action.index)
      let newSelected = state.selectedGroupIndex
      if (newSelected !== null) {
        if (newSelected === action.index) {
          newSelected = null
        } else if (newSelected > action.index) {
          newSelected = newSelected - 1
        }
      }
      return { ...state, pageGroups: newGroups, selectedGroupIndex: newSelected }
    }

    case 'SET_GROUP_COUNT': {
      const count = Math.max(1, action.count)
      const newGroups = state.pageGroups.map((g, i) =>
        i === action.index ? { ...g, count } : g,
      )
      return { ...state, pageGroups: newGroups }
    }

    case 'REORDER_GROUP': {
      const groups = [...state.pageGroups]
      const [moved] = groups.splice(action.fromIndex, 1)
      groups.splice(action.toIndex, 0, moved)
      let newSelected = state.selectedGroupIndex
      if (newSelected === action.fromIndex) {
        newSelected = action.toIndex
      } else if (newSelected !== null) {
        if (action.fromIndex < newSelected && action.toIndex >= newSelected) {
          newSelected = newSelected - 1
        } else if (action.fromIndex > newSelected && action.toIndex <= newSelected) {
          newSelected = newSelected + 1
        }
      }
      return { ...state, pageGroups: groups, selectedGroupIndex: newSelected }
    }

    case 'SELECT_GROUP':
      return { ...state, selectedGroupIndex: action.index }

    case 'SET_DEVICE_ID':
      return { ...state, deviceId: action.deviceId as DeviceId }

    case 'SET_GROUP_TEMPLATE': {
      const newGroups = state.pageGroups.map((g, i) =>
        i === action.index
          ? { ...g, templateRef: action.templateRef, templateName: action.templateName, iconData: action.iconData }
          : g,
      )
      return { ...state, pageGroups: newGroups }
    }

    case 'SET_ORIENTATION':
      return { ...state, orientation: action.orientation }

    case 'SET_DEPLOYED_UUID':
      return { ...state, deployedUuid: action.deployedUuid }

    case 'LOAD':
      return {
        id: action.draft.id,
        name: action.draft.name,
        pageGroups: action.draft.pageGroups,
        deviceId: action.draft.deviceId || getPreferredDeviceType(),
        orientation: action.draft.orientation,
        deployedUuid: action.draft.deployedUuid,
        selectedGroupIndex: null,
      }

    case 'RESET':
      return initialNotebookEditorState

    default:
      return state
  }
}

/**
 * Hook for notebook editor state with optional debounced auto-save (500ms).
 *
 * @param onAutoSave - Called with the current state after each change, debounced at 500ms.
 * @returns `{ state, dispatch }` — dispatch `NotebookEditorAction` to mutate state.
 */
export function useNotebookEditor(onAutoSave?: (state: NotebookEditorState) => void) {
  const [state, dispatch] = useReducer(notebookEditorReducer, initialNotebookEditorState)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced auto-save
  useEffect(() => {
    if (!onAutoSave || !state.id) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      onAutoSave(state)
    }, 500)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [state, onAutoSave])

  return { state, dispatch }
}
