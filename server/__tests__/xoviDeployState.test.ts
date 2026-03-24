// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync as fsWriteFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  readXoviDeployedState,
  writeXoviDeployedState,
  capturePristineState,
  addDeployedExtensions,
  removeDeployedExtensions,
  clearXoviDeployedState,
  type XoviDeployedState,
} from '../lib/xoviDeployState.ts'

let tmpBase: string
let statePath: string

beforeEach(() => {
  tmpBase = resolve(tmpdir(), `xovi-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmpBase, { recursive: true })
  statePath = resolve(tmpBase, '.xovi-deployed')
})

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true })
})

describe('readXoviDeployedState', () => {
  it('returns null when file does not exist', () => {
    expect(readXoviDeployedState(statePath)).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    fsWriteFileSync(statePath, 'not json', 'utf8')
    expect(readXoviDeployedState(statePath)).toBeNull()
  })

  it('reads a valid state file', () => {
    const state: XoviDeployedState = {
      pristineFiles: ['a.qmd'],
      deployedExtensionIds: ['ext1'],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    writeXoviDeployedState(statePath, state)
    expect(readXoviDeployedState(statePath)).toEqual(state)
  })
})

describe('writeXoviDeployedState', () => {
  it('creates parent directories', () => {
    const deepPath = resolve(tmpBase, 'a/b/c/.xovi-deployed')
    const state: XoviDeployedState = {
      pristineFiles: [],
      deployedExtensionIds: [],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    writeXoviDeployedState(deepPath, state)
    expect(existsSync(deepPath)).toBe(true)
    expect(JSON.parse(readFileSync(deepPath, 'utf8'))).toEqual(state)
  })
})

describe('capturePristineState', () => {
  it('creates state file with pristine files', () => {
    const state = capturePristineState(statePath, ['b.qmd', 'a.qmd'])
    expect(state.pristineFiles).toEqual(['a.qmd', 'b.qmd']) // sorted
    expect(state.deployedExtensionIds).toEqual([])
    expect(state.capturedAt).toBeTruthy()
    expect(existsSync(statePath)).toBe(true)
  })

  it('is idempotent — does not overwrite existing state', () => {
    const first = capturePristineState(statePath, ['first.qmd'])
    const second = capturePristineState(statePath, ['second.qmd'])
    expect(second).toEqual(first)
    expect(second.pristineFiles).toEqual(['first.qmd'])
  })
})

describe('addDeployedExtensions', () => {
  it('adds new IDs to the list', () => {
    const state: XoviDeployedState = {
      pristineFiles: [],
      deployedExtensionIds: ['a'],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const updated = addDeployedExtensions(state, ['b', 'c'])
    expect(updated.deployedExtensionIds).toEqual(['a', 'b', 'c'])
    expect(updated.updatedAt).not.toBe(state.updatedAt)
  })

  it('deduplicates IDs', () => {
    const state: XoviDeployedState = {
      pristineFiles: [],
      deployedExtensionIds: ['a', 'b'],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const updated = addDeployedExtensions(state, ['b', 'c'])
    expect(updated.deployedExtensionIds).toEqual(['a', 'b', 'c'])
  })

  it('preserves pristineFiles', () => {
    const state: XoviDeployedState = {
      pristineFiles: ['x.qmd'],
      deployedExtensionIds: [],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const updated = addDeployedExtensions(state, ['a'])
    expect(updated.pristineFiles).toEqual(['x.qmd'])
  })
})

describe('removeDeployedExtensions', () => {
  it('removes specified IDs', () => {
    const state: XoviDeployedState = {
      pristineFiles: [],
      deployedExtensionIds: ['a', 'b', 'c'],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const updated = removeDeployedExtensions(state, ['b'])
    expect(updated.deployedExtensionIds).toEqual(['a', 'c'])
  })

  it('ignores IDs not in the list', () => {
    const state: XoviDeployedState = {
      pristineFiles: [],
      deployedExtensionIds: ['a'],
      capturedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const updated = removeDeployedExtensions(state, ['z'])
    expect(updated.deployedExtensionIds).toEqual(['a'])
  })
})

describe('clearXoviDeployedState', () => {
  it('deletes the file', () => {
    capturePristineState(statePath, [])
    expect(existsSync(statePath)).toBe(true)
    clearXoviDeployedState(statePath)
    expect(existsSync(statePath)).toBe(false)
  })

  it('is safe to call when file does not exist', () => {
    expect(() => clearXoviDeployedState(statePath)).not.toThrow()
  })
})
