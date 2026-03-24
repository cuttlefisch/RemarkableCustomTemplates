/**
 * xovi deploy state tracking — records which extensions we deployed
 * and what QMD files existed on the device before our first deploy.
 *
 * Pure read/write functions (no SSH). Follows the same pattern as deviceStore.ts.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'

export interface XoviDeployedState {
  /** QMD filenames on device before our first deploy */
  pristineFiles: string[]
  /** Extension IDs we've deployed */
  deployedExtensionIds: string[]
  /** ISO timestamp of pristine capture */
  capturedAt: string
  /** ISO timestamp of last mutation */
  updatedAt: string
}

/** Read the tracking state from disk. Returns null if file doesn't exist. */
export function readXoviDeployedState(path: string): XoviDeployedState | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as XoviDeployedState
  } catch {
    return null
  }
}

/** Write the tracking state to disk. Creates parent directories if needed. */
export function writeXoviDeployedState(path: string, state: XoviDeployedState): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2), 'utf8')
}

/**
 * Capture pristine device state (idempotent — only creates if file doesn't exist).
 * Returns the existing state if already captured, or creates a new one.
 */
export function capturePristineState(path: string, existingQmdFiles: string[]): XoviDeployedState {
  const existing = readXoviDeployedState(path)
  if (existing) return existing

  const now = new Date().toISOString()
  const state: XoviDeployedState = {
    pristineFiles: [...existingQmdFiles].sort(),
    deployedExtensionIds: [],
    capturedAt: now,
    updatedAt: now,
  }
  writeXoviDeployedState(path, state)
  return state
}

/** Return updated state with new extension IDs added (deduped). */
export function addDeployedExtensions(state: XoviDeployedState, ids: string[]): XoviDeployedState {
  const existing = new Set(state.deployedExtensionIds)
  for (const id of ids) existing.add(id)
  return {
    ...state,
    deployedExtensionIds: [...existing].sort(),
    updatedAt: new Date().toISOString(),
  }
}

/** Return updated state with extension IDs removed. */
export function removeDeployedExtensions(state: XoviDeployedState, ids: string[]): XoviDeployedState {
  const toRemove = new Set(ids)
  return {
    ...state,
    deployedExtensionIds: state.deployedExtensionIds.filter(id => !toRemove.has(id)),
    updatedAt: new Date().toISOString(),
  }
}

/** Delete the tracking file. */
export function clearXoviDeployedState(path: string): void {
  if (existsSync(path)) unlinkSync(path)
}
