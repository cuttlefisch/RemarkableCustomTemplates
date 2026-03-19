// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `samples-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/samples'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

const sampleRegistry = {
  templates: [
    { name: 'Sample Grid', filename: 'samples/P Sample Grid', iconCode: '\ue9d8', categories: ['Samples'] },
    { name: 'Sample Lined', filename: 'samples/P Sample Lined', iconCode: '\ue9d8', categories: ['Samples'] },
  ],
}

const sampleTemplate = JSON.stringify({
  name: 'Sample Grid', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Samples'], orientation: 'portrait', constants: [], items: [],
})

describe('sample templates', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
    // Write samples registry and a template file
    writeFileSync(config.samplesRegistry, JSON.stringify(sampleRegistry))
    writeFileSync(resolve(config.samplesDir, 'P Sample Grid.template'), sampleTemplate)
    writeFileSync(resolve(config.samplesDir, 'P Sample Lined.template'), sampleTemplate)
    // Write official templates so merged registry returns 200
    writeFileSync(resolve(config.officialDir, 'templates.json'), JSON.stringify({ templates: [] }))
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  describe('GET /templates/templates.json', () => {
    it('includes samples in merged registry', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      const names = body.templates.map((t: { name: string }) => t.name)
      expect(names).toContain('Sample Grid')
      expect(names).toContain('Sample Lined')
      await app.close()
    })

    it('excludes hidden samples from merged registry', async () => {
      writeFileSync(config.hiddenSamplesPath, JSON.stringify(['samples/P Sample Grid']))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      const names = body.templates.map((t: { name: string }) => t.name)
      expect(names).not.toContain('Sample Grid')
      expect(names).toContain('Sample Lined')
      await app.close()
    })
  })

  describe('GET /templates/samples/*', () => {
    it('serves sample template files', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/samples/P%20Sample%20Grid.template' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.name).toBe('Sample Grid')
      await app.close()
    })

    it('returns 404 for non-existent sample files', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/templates/samples/nope.template' })
      expect(res.statusCode).toBe(404)
      await app.close()
    })
  })

  describe('POST /api/sample-templates/hide', () => {
    it('hides a sample template', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/sample-templates/hide',
        payload: { filename: 'samples/P Sample Grid' },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.ok).toBe(true)
      expect(body.hidden).toContain('samples/P Sample Grid')

      // Verify it's excluded from merged registry
      const regRes = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      const regBody = JSON.parse(regRes.body)
      const names = regBody.templates.map((t: { name: string }) => t.name)
      expect(names).not.toContain('Sample Grid')
      await app.close()
    })

    it('does not duplicate entries when hiding twice', async () => {
      const app = await createApp(config)
      await app.inject({ method: 'POST', url: '/api/sample-templates/hide', payload: { filename: 'samples/P Sample Grid' } })
      await app.inject({ method: 'POST', url: '/api/sample-templates/hide', payload: { filename: 'samples/P Sample Grid' } })

      const hidden = JSON.parse(readFileSync(config.hiddenSamplesPath, 'utf8'))
      expect(hidden.filter((f: string) => f === 'samples/P Sample Grid')).toHaveLength(1)
      await app.close()
    })

    it('rejects missing filename', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/sample-templates/hide', payload: {} })
      expect(res.statusCode).toBe(400)
      await app.close()
    })
  })

  describe('POST /api/sample-templates/restore-all', () => {
    it('restores all hidden samples', async () => {
      writeFileSync(config.hiddenSamplesPath, JSON.stringify(['samples/P Sample Grid', 'samples/P Sample Lined']))

      const app = await createApp(config)
      const res = await app.inject({ method: 'POST', url: '/api/sample-templates/restore-all' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.ok).toBe(true)
      expect(body.restored).toBe(2)

      // All samples should be back in merged registry
      const regRes = await app.inject({ method: 'GET', url: '/templates/templates.json' })
      const regBody = JSON.parse(regRes.body)
      const names = regBody.templates.map((t: { name: string }) => t.name)
      expect(names).toContain('Sample Grid')
      expect(names).toContain('Sample Lined')
      await app.close()
    })
  })

  describe('GET /api/sample-templates/hidden', () => {
    it('returns empty list when nothing is hidden', async () => {
      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/sample-templates/hidden' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.hidden).toEqual([])
      await app.close()
    })

    it('returns hidden filenames', async () => {
      writeFileSync(config.hiddenSamplesPath, JSON.stringify(['samples/P Sample Grid']))

      const app = await createApp(config)
      const res = await app.inject({ method: 'GET', url: '/api/sample-templates/hidden' })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.hidden).toEqual(['samples/P Sample Grid'])
      await app.close()
    })
  })
})
