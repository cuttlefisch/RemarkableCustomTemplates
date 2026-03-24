import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  startOperation,
  getActiveOperation,
  completeOperation,
  failOperation,
  updateProgress,
  OperationAlreadyRunningError,
  _resetForTests,
  EXPIRY_MS,
} from '../lib/operationTracker.ts'

beforeEach(() => {
  _resetForTests()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('operationTracker', () => {
  describe('startOperation', () => {
    it('creates a running operation entry', () => {
      startOperation('dev-1', 'deploy-methods')
      const op = getActiveOperation('dev-1')
      expect(op).not.toBeNull()
      expect(op!.status).toBe('running')
      expect(op!.operationName).toBe('deploy-methods')
      expect(op!.deviceId).toBe('dev-1')
      expect(op!.lastProgress).toBeNull()
      expect(op!.doneData).toBeNull()
      expect(op!.errorData).toBeNull()
      expect(op!.startedAt).toBeGreaterThan(0)
      expect(op!.finishedAt).toBeNull()
    })

    it('throws OperationAlreadyRunningError if device has running op', () => {
      startOperation('dev-1', 'deploy-methods')
      expect(() => startOperation('dev-1', 'rollback-methods')).toThrow(OperationAlreadyRunningError)
      try {
        startOperation('dev-1', 'rollback-methods')
      } catch (e) {
        expect((e as OperationAlreadyRunningError).operationName).toBe('deploy-methods')
      }
    })

    it('allows starting a new op after previous one completed', () => {
      startOperation('dev-1', 'deploy-methods')
      completeOperation('dev-1', { steps: ['done'] })
      startOperation('dev-1', 'rollback-methods')
      const op = getActiveOperation('dev-1')
      expect(op!.operationName).toBe('rollback-methods')
      expect(op!.status).toBe('running')
    })

    it('allows different devices to run ops concurrently', () => {
      startOperation('dev-1', 'deploy-methods')
      startOperation('dev-2', 'deploy-methods')
      expect(getActiveOperation('dev-1')!.status).toBe('running')
      expect(getActiveOperation('dev-2')!.status).toBe('running')
    })
  })

  describe('updateProgress', () => {
    it('updates lastProgress on the tracked operation', () => {
      startOperation('dev-1', 'deploy-methods')
      updateProgress('dev-1', { phase: 'Pushing files', current: 3, total: 10 })
      const op = getActiveOperation('dev-1')
      expect(op!.lastProgress).toEqual({ phase: 'Pushing files', current: 3, total: 10 })
    })

    it('overwrites previous progress (only latest kept)', () => {
      startOperation('dev-1', 'deploy-methods')
      updateProgress('dev-1', { phase: 'Step 1' })
      updateProgress('dev-1', { phase: 'Step 2', current: 5, total: 10 })
      const op = getActiveOperation('dev-1')
      expect(op!.lastProgress!.phase).toBe('Step 2')
    })

    it('is a no-op if no operation exists for device', () => {
      expect(() => updateProgress('nonexistent', { phase: 'test' })).not.toThrow()
    })
  })

  describe('completeOperation', () => {
    it('sets status to done with payload', () => {
      startOperation('dev-1', 'deploy-methods')
      completeOperation('dev-1', { steps: ['a', 'b'], count: 5 })
      const op = getActiveOperation('dev-1')
      expect(op!.status).toBe('done')
      expect(op!.doneData).toEqual({ steps: ['a', 'b'], count: 5 })
      expect(op!.finishedAt).toBeGreaterThan(0)
    })
  })

  describe('failOperation', () => {
    it('sets status to error with error info', () => {
      startOperation('dev-1', 'deploy-methods')
      failOperation('dev-1', 'SSH connection lost', 'Check device IP', 'ECONNREFUSED')
      const op = getActiveOperation('dev-1')
      expect(op!.status).toBe('error')
      expect(op!.errorData).toEqual({
        message: 'SSH connection lost',
        hint: 'Check device IP',
        rawError: 'ECONNREFUSED',
      })
      expect(op!.finishedAt).toBeGreaterThan(0)
    })
  })

  describe('getActiveOperation', () => {
    it('returns null for unknown device', () => {
      expect(getActiveOperation('nonexistent')).toBeNull()
    })

    it('returns completed operation within expiry window', () => {
      startOperation('dev-1', 'deploy-methods')
      completeOperation('dev-1', { ok: true })
      expect(getActiveOperation('dev-1')).not.toBeNull()
    })

    it('returns null for expired completed operation', () => {
      vi.useFakeTimers()
      startOperation('dev-1', 'deploy-methods')
      completeOperation('dev-1', { ok: true })
      vi.advanceTimersByTime(EXPIRY_MS + 1000)
      expect(getActiveOperation('dev-1')).toBeNull()
    })

    it('never expires a running operation', () => {
      vi.useFakeTimers()
      startOperation('dev-1', 'deploy-methods')
      vi.advanceTimersByTime(EXPIRY_MS * 10)
      expect(getActiveOperation('dev-1')).not.toBeNull()
      expect(getActiveOperation('dev-1')!.status).toBe('running')
    })
  })
})
