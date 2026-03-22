import { describe, it, expect } from 'vitest'
import {
  notebookEditorReducer,
  initialNotebookEditorState,
  type NotebookEditorState,
} from '../hooks/useNotebookEditor'
import type { PageGroup } from '../types/notebook'

function dispatch(state: NotebookEditorState, action: Parameters<typeof notebookEditorReducer>[1]): NotebookEditorState {
  return notebookEditorReducer(state, action)
}

const testGroup: PageGroup = {
  id: 'g1',
  templateRef: 'Blank',
  templateName: 'Blank',
  count: 1,
}

const testGroup2: PageGroup = {
  id: 'g2',
  templateRef: 'Grid',
  templateName: 'Grid',
  count: 3,
}

describe('notebookEditorReducer', () => {
  describe('SET_NAME', () => {
    it('sets the notebook name', () => {
      const state = dispatch(initialNotebookEditorState, { type: 'SET_NAME', name: 'My Notebook' })
      expect(state.name).toBe('My Notebook')
    })
  })

  describe('ADD_GROUP', () => {
    it('adds a page group', () => {
      const state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      expect(state.pageGroups).toHaveLength(1)
      expect(state.pageGroups[0]).toEqual(testGroup)
    })

    it('appends groups in order', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'ADD_GROUP', group: testGroup2 })
      expect(state.pageGroups).toHaveLength(2)
      expect(state.pageGroups[0].id).toBe('g1')
      expect(state.pageGroups[1].id).toBe('g2')
    })

    it('selects the newly added group', () => {
      const state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      expect(state.selectedGroupIndex).toBe(0)
    })
  })

  describe('REMOVE_GROUP', () => {
    it('removes a group by index', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'ADD_GROUP', group: testGroup2 })
      state = dispatch(state, { type: 'REMOVE_GROUP', index: 0 })
      expect(state.pageGroups).toHaveLength(1)
      expect(state.pageGroups[0].id).toBe('g2')
    })

    it('clears selection if removed group was selected', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'SELECT_GROUP', index: 0 })
      state = dispatch(state, { type: 'REMOVE_GROUP', index: 0 })
      expect(state.selectedGroupIndex).toBeNull()
    })

    it('adjusts selection index when earlier group removed', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'ADD_GROUP', group: testGroup2 })
      state = dispatch(state, { type: 'SELECT_GROUP', index: 1 })
      state = dispatch(state, { type: 'REMOVE_GROUP', index: 0 })
      expect(state.selectedGroupIndex).toBe(0)
    })
  })

  describe('SET_GROUP_COUNT', () => {
    it('updates the count of a group', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'SET_GROUP_COUNT', index: 0, count: 5 })
      expect(state.pageGroups[0].count).toBe(5)
    })

    it('clamps count to minimum 1', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'SET_GROUP_COUNT', index: 0, count: 0 })
      expect(state.pageGroups[0].count).toBe(1)
    })
  })

  describe('REORDER_GROUP', () => {
    it('moves a group from one index to another', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'ADD_GROUP', group: testGroup2 })
      state = dispatch(state, { type: 'REORDER_GROUP', fromIndex: 0, toIndex: 1 })
      expect(state.pageGroups[0].id).toBe('g2')
      expect(state.pageGroups[1].id).toBe('g1')
    })

    it('updates selection to follow moved group', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'ADD_GROUP', group: testGroup2 })
      state = dispatch(state, { type: 'SELECT_GROUP', index: 0 })
      state = dispatch(state, { type: 'REORDER_GROUP', fromIndex: 0, toIndex: 1 })
      expect(state.selectedGroupIndex).toBe(1)
    })
  })

  describe('SELECT_GROUP', () => {
    it('sets selectedGroupIndex', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'SELECT_GROUP', index: 0 })
      expect(state.selectedGroupIndex).toBe(0)
    })

    it('allows null to deselect', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'SELECT_GROUP', index: 0 })
      state = dispatch(state, { type: 'SELECT_GROUP', index: null })
      expect(state.selectedGroupIndex).toBeNull()
    })
  })

  describe('SET_DEVICE_ID', () => {
    it('sets the device id', () => {
      const state = dispatch(initialNotebookEditorState, { type: 'SET_DEVICE_ID', deviceId: 'rmPP' })
      expect(state.deviceId).toBe('rmPP')
    })
  })

  describe('SET_GROUP_TEMPLATE', () => {
    it('updates template ref and name for a group', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, {
        type: 'SET_GROUP_TEMPLATE',
        index: 0,
        templateRef: 'Dots',
        templateName: 'Dots',
        iconData: 'base64...',
      })
      expect(state.pageGroups[0].templateRef).toBe('Dots')
      expect(state.pageGroups[0].templateName).toBe('Dots')
      expect(state.pageGroups[0].iconData).toBe('base64...')
    })
  })

  describe('SET_ORIENTATION', () => {
    it('sets orientation', () => {
      const state = dispatch(initialNotebookEditorState, { type: 'SET_ORIENTATION', orientation: 'landscape' })
      expect(state.orientation).toBe('landscape')
    })
  })

  describe('LOAD', () => {
    it('loads a draft into the editor state', () => {
      const draft = {
        id: 'test-id',
        name: 'Loaded Notebook',
        pageGroups: [testGroup, testGroup2],
        deviceId: 'rmPP' as const,
        orientation: 'landscape' as const,
        lastModified: Date.now(),
      }
      const state = dispatch(initialNotebookEditorState, { type: 'LOAD', draft })
      expect(state.id).toBe('test-id')
      expect(state.name).toBe('Loaded Notebook')
      expect(state.pageGroups).toHaveLength(2)
      expect(state.deviceId).toBe('rmPP')
      expect(state.orientation).toBe('landscape')
      expect(state.selectedGroupIndex).toBeNull()
    })
  })

  describe('RESET', () => {
    it('resets to initial state', () => {
      let state = dispatch(initialNotebookEditorState, { type: 'SET_NAME', name: 'Test' })
      state = dispatch(state, { type: 'ADD_GROUP', group: testGroup })
      state = dispatch(state, { type: 'RESET' })
      expect(state).toEqual(initialNotebookEditorState)
    })
  })
})
