import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig } from '../config.ts'

describe('builtin notebook routes', () => {
  let tmpDir: string
  let app: Awaited<ReturnType<typeof createApp>>

  const sampleRegistry = {
    templates: [
      { name: 'Grid', filename: 'samples/P Grid', iconCode: '', categories: ['Grids'], iconData: 'grid-icon' },
      { name: 'Lines', filename: 'samples/P Lines', iconCode: '', categories: ['Lines'] },
    ],
  }

  const debugRegistry = {
    templates: [
      { name: 'Debug', filename: 'debug/P Debug', iconCode: '', categories: ['Debug'], iconData: 'debug-icon' },
    ],
  }

  beforeEach(async () => {
    tmpDir = mkdtempSync(resolve(tmpdir(), 'builtin-routes-'))
    const templatesDir = resolve(tmpDir, 'public/templates')
    mkdirSync(resolve(templatesDir, 'samples'), { recursive: true })
    mkdirSync(resolve(templatesDir, 'debug'), { recursive: true })
    mkdirSync(resolve(templatesDir, 'custom'), { recursive: true })
    mkdirSync(resolve(tmpDir, 'data'), { recursive: true })

    writeFileSync(resolve(templatesDir, 'samples/samples-registry.json'), JSON.stringify(sampleRegistry))
    writeFileSync(resolve(templatesDir, 'debug/debug-registry.json'), JSON.stringify(debugRegistry))

    const config = resolveConfig({ dataDir: tmpDir, port: 0, production: false })
    app = await createApp(config)
  })

  afterEach(async () => {
    await app.close()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('GET /api/builtin-notebooks returns both notebooks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/builtin-notebooks' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.notebooks).toHaveLength(2)

    const sample = body.notebooks.find((n: { id: string }) => n.id === '__sample-notebook__')
    const debug = body.notebooks.find((n: { id: string }) => n.id === '__debug-notebook__')

    expect(sample).toBeDefined()
    expect(sample.source).toBe('sample')
    expect(sample.pageGroups).toHaveLength(2)
    expect(sample.name).toBe('Sample Notebook')

    expect(debug).toBeDefined()
    expect(debug.source).toBe('debug')
    expect(debug.pageGroups).toHaveLength(1)
    expect(debug.name).toBe('Debug Notebook')
  })

  it('page group count matches registry entries', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/builtin-notebooks' })
    const body = res.json()
    const sample = body.notebooks.find((n: { id: string }) => n.id === '__sample-notebook__')
    expect(sample.pageGroups).toHaveLength(sampleRegistry.templates.length)
  })

  it('hidden notebooks are excluded from GET', async () => {
    // Hide the sample notebook
    const hideRes = await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: { id: '__sample-notebook__' },
    })
    expect(hideRes.statusCode).toBe(200)

    const res = await app.inject({ method: 'GET', url: '/api/builtin-notebooks' })
    const body = res.json()
    expect(body.notebooks).toHaveLength(1)
    expect(body.notebooks[0].id).toBe('__debug-notebook__')
  })

  it('GET /api/builtin-notebooks/hidden returns hidden IDs', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: { id: '__sample-notebook__' },
    })

    const res = await app.inject({ method: 'GET', url: '/api/builtin-notebooks/hidden' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.hidden).toEqual(['__sample-notebook__'])
  })

  it('restore-all clears hidden list', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: { id: '__sample-notebook__' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: { id: '__debug-notebook__' },
    })

    const restoreRes = await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/restore-all',
    })
    expect(restoreRes.statusCode).toBe(200)
    expect(restoreRes.json().restored).toBe(2)

    const res = await app.inject({ method: 'GET', url: '/api/builtin-notebooks' })
    expect(res.json().notebooks).toHaveLength(2)
  })

  it('hiding same notebook twice is idempotent', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: { id: '__sample-notebook__' },
    })
    await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: { id: '__sample-notebook__' },
    })

    const res = await app.inject({ method: 'GET', url: '/api/builtin-notebooks/hidden' })
    expect(res.json().hidden).toEqual(['__sample-notebook__'])
  })

  it('hide requires id field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/builtin-notebooks/hide',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})
