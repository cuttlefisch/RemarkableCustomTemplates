/**
 * In-memory tracker for long-running device operations.
 *
 * Stores the latest operation per device so the client can recover
 * state after a page refresh — see in-progress operations or results
 * that completed while disconnected.
 *
 * One slot per device. Starting a new operation overwrites a completed one.
 * Running operations block new ones on the same device (409 Conflict).
 * Completed operations auto-expire after {@link EXPIRY_MS}.
 */

import type { FastifyReply } from 'fastify'
import { createNdjsonStream, type NdjsonStream } from './ndjsonStream.ts'

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrackedOperation {
  deviceId: string
  operationName: string
  status: 'running' | 'done' | 'error'
  startedAt: number
  finishedAt: number | null
  lastProgress: { phase: string; current?: number; total?: number } | null
  doneData: Record<string, unknown> | null
  errorData: { message: string; hint?: string; rawError?: string } | null
}

export class OperationAlreadyRunningError extends Error {
  operationName: string
  constructor(operationName: string) {
    super(`Another operation is already running: ${operationName}`)
    this.operationName = operationName
  }
}

// ── State ────────────────────────────────────────────────────────────────────

/** How long completed operations remain visible before expiring. */
export const EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

const operations = new Map<string, TrackedOperation>()

// ── Core API ─────────────────────────────────────────────────────────────────

/** Register a new running operation for a device. Throws if one is already running. */
export function startOperation(deviceId: string, operationName: string): TrackedOperation {
  const existing = operations.get(deviceId)
  if (existing?.status === 'running') {
    throw new OperationAlreadyRunningError(existing.operationName)
  }

  const op: TrackedOperation = {
    deviceId,
    operationName,
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    lastProgress: null,
    doneData: null,
    errorData: null,
  }
  operations.set(deviceId, op)
  return op
}

/** Get the active or recently-completed operation for a device, or null if expired/absent. */
export function getActiveOperation(deviceId: string): TrackedOperation | null {
  const op = operations.get(deviceId)
  if (!op) return null

  // Running operations never expire
  if (op.status === 'running') return op

  // Completed operations expire after EXPIRY_MS
  if (op.finishedAt && Date.now() - op.finishedAt > EXPIRY_MS) {
    operations.delete(deviceId)
    return null
  }

  return op
}

/** Update progress on a running operation. No-op if no operation exists. */
export function updateProgress(deviceId: string, progress: { phase: string; current?: number; total?: number }): void {
  const op = operations.get(deviceId)
  if (op?.status === 'running') {
    op.lastProgress = progress
  }
}

/** Mark an operation as successfully completed. */
export function completeOperation(deviceId: string, data: Record<string, unknown>): void {
  const op = operations.get(deviceId)
  if (op?.status === 'running') {
    op.status = 'done'
    op.finishedAt = Date.now()
    op.doneData = data
  }
}

/** Mark an operation as failed. */
export function failOperation(deviceId: string, message: string, hint?: string, rawError?: string): void {
  const op = operations.get(deviceId)
  if (op?.status === 'running') {
    op.status = 'error'
    op.finishedAt = Date.now()
    op.errorData = { message, hint, rawError }
  }
}

// ── Tracked NDJSON stream ────────────────────────────────────────────────────

/**
 * Create an NDJSON stream that also writes events to the operation tracker.
 * Drop-in replacement for {@link createNdjsonStream} — same interface,
 * but also records progress/done/error for client reconnection.
 *
 * @throws {OperationAlreadyRunningError} if the device already has a running operation
 */
export function createTrackedNdjsonStream(
  reply: FastifyReply,
  deviceId: string,
  operationName: string,
): NdjsonStream {
  startOperation(deviceId, operationName)
  const stream = createNdjsonStream(reply)

  return {
    progress(phase, current?, total?) {
      updateProgress(deviceId, { phase, current, total })
      stream.progress(phase, current, total)
    },
    done(data) {
      completeOperation(deviceId, data)
      stream.done(data)
    },
    error(message, hint?, rawError?) {
      failOperation(deviceId, message, hint, rawError)
      stream.error(message, hint, rawError)
    },
  }
}

// ── Testing ──────────────────────────────────────────────────────────────────

/** Clear all tracked operations. For testing only. */
export function _resetForTests(): void {
  operations.clear()
}
