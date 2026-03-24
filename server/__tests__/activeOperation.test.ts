import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from '../app.ts'
import { resolveConfig } from '../config.ts'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  startOperation,
  completeOperation,
  failOperation,
  updateProgress,
  _resetForTests,
} from '../lib/operationTracker.ts'

let app: Awaited<ReturnType<typeof createApp>>

beforeEach(async () => {
  _resetForTests()
  const tmp = mkdtempSync(join(tmpdir(), 'active-op-test-'))
  const config = resolveConfig({ dataDir: tmp })
  app = await createApp(config)
})

describe('GET /api/devices/:id/active-operation', () => {
  it('returns { active: false } when no operation exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/devices/dev-1/active-operation' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ active: false })
  })

  it('returns running operation with progress', async () => {
    startOperation('dev-1', 'deploy-methods')
    updateProgress('dev-1', { phase: 'Pushing files', current: 3, total: 10 })

    const res = await app.inject({ method: 'GET', url: '/api/devices/dev-1/active-operation' })
    const body = res.json()
    expect(body.active).toBe(true)
    expect(body.operationName).toBe('deploy-methods')
    expect(body.status).toBe('running')
    expect(body.lastProgress).toEqual({ phase: 'Pushing files', current: 3, total: 10 })
    expect(body.doneData).toBeNull()
    expect(body.errorData).toBeNull()
  })

  it('returns completed operation with done data', async () => {
    startOperation('dev-1', 'deploy-methods')
    completeOperation('dev-1', { steps: ['connected', 'deployed'], count: 5 })

    const res = await app.inject({ method: 'GET', url: '/api/devices/dev-1/active-operation' })
    const body = res.json()
    expect(body.active).toBe(true)
    expect(body.status).toBe('done')
    expect(body.doneData.steps).toEqual(['connected', 'deployed'])
    expect(body.finishedAt).toBeGreaterThan(0)
  })

  it('returns failed operation with error data', async () => {
    startOperation('dev-1', 'deploy-methods')
    failOperation('dev-1', 'SSH connection lost', 'Check device IP', 'ECONNREFUSED')

    const res = await app.inject({ method: 'GET', url: '/api/devices/dev-1/active-operation' })
    const body = res.json()
    expect(body.active).toBe(true)
    expect(body.status).toBe('error')
    expect(body.errorData.message).toBe('SSH connection lost')
    expect(body.errorData.hint).toBe('Check device IP')
  })

  it('does not leak operations between devices', async () => {
    startOperation('dev-1', 'deploy-methods')

    const res = await app.inject({ method: 'GET', url: '/api/devices/dev-2/active-operation' })
    expect(res.json()).toEqual({ active: false })
  })
})
