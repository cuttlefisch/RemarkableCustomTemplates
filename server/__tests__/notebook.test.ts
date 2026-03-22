// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { unzipSync, strFromU8 } from 'fflate'
import { createApp } from '../app.ts'
import { resolveConfig, type ServerConfig } from '../config.ts'

function makeConfig(): ServerConfig {
  const base = resolve(tmpdir(), `notebook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(resolve(base, 'public/templates/custom'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/debug'), { recursive: true })
  mkdirSync(resolve(base, 'public/templates/methods'), { recursive: true })
  mkdirSync(resolve(base, 'remarkable_official_templates'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-dist'), { recursive: true })
  mkdirSync(resolve(base, 'rm-methods-backups'), { recursive: true })
  mkdirSync(resolve(base, 'data/ssh'), { recursive: true })
  mkdirSync(resolve(base, 'notebook-dist'), { recursive: true })
  return resolveConfig({ dataDir: base, port: 0, production: false })
}

const validBody = {
  name: 'Test Notebook',
  pageGroups: [
    { id: 'g1', templateRef: 'Blank', templateName: 'Blank', count: 2 },
    { id: 'g2', templateRef: '66d2157c-test:p', templateName: 'Custom Grid', count: 1 },
  ],
}

const validTemplate = JSON.stringify({
  name: 'Test', author: 'test', templateVersion: '1.0.0', formatVersion: 1,
  categories: ['Custom'], orientation: 'portrait', constants: [], items: [],
})

function seedCustomTemplate(config: ServerConfig, name: string, uuid?: string) {
  const registryPath = config.customRegistry
  let reg: { templates: Array<Record<string, unknown>> } = { templates: [] }
  try { reg = JSON.parse(readFileSync(registryPath, 'utf8')) } catch { /* empty */ }

  const entry: Record<string, unknown> = {
    name,
    filename: `custom/P ${name}`,
    iconCode: '\\ue9d8',
    landscape: false,
    categories: ['Custom'],
  }
  if (uuid) entry.rmMethodsId = uuid
  reg.templates.push(entry)

  writeFileSync(registryPath, JSON.stringify(reg, null, 2))
  writeFileSync(resolve(config.customDir, `P ${name}.template`), validTemplate)
}

describe('single template export', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  it('exports a single template as rm_methods ZIP', async () => {
    const uuid = '11111111-1111-1111-1111-111111111111'
    seedCustomTemplate(config, 'My Grid', uuid)
    const app = await createApp(config)
    const res = await app.inject({
      method: 'GET',
      url: `/api/export-template/${uuid}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/zip')

    const zip = unzipSync(new Uint8Array(res.rawPayload))
    const filenames = Object.keys(zip)

    // Should have 3 files: uuid.template, uuid.metadata, uuid.content
    expect(filenames).toHaveLength(3)
    expect(filenames).toContain(`${uuid}.template`)
    expect(filenames).toContain(`${uuid}.metadata`)
    expect(filenames).toContain(`${uuid}.content`)

    // Verify template content is valid JSON
    const tplContent = JSON.parse(strFromU8(zip[`${uuid}.template`]))
    expect(tplContent.name).toBe('Test')

    await app.close()
  })

  it('returns 404 for unknown template UUID', async () => {
    const app = await createApp(config)
    const res = await app.inject({
      method: 'GET',
      url: '/api/export-template/nonexistent-uuid',
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('assigns UUID and exports template that has no rmMethodsId yet', async () => {
    seedCustomTemplate(config, 'No UUID Template') // no UUID provided
    const app = await createApp(config)

    // First, we need to find the assigned UUID by building
    // The endpoint should handle this — export by filename slug
    const res = await app.inject({
      method: 'GET',
      url: `/api/export-template-by-name/${encodeURIComponent('P No UUID Template')}`,
    })
    expect(res.statusCode).toBe(200)

    const zip = unzipSync(new Uint8Array(res.rawPayload))
    const filenames = Object.keys(zip)
    expect(filenames).toHaveLength(3)
    expect(filenames.some(f => f.endsWith('.template'))).toBe(true)
    expect(filenames.some(f => f.endsWith('.metadata'))).toBe(true)
    expect(filenames.some(f => f.endsWith('.content'))).toBe(true)

    await app.close()
  })
})

describe('notebook routes', () => {
  let config: ServerConfig

  beforeEach(() => {
    config = makeConfig()
  })

  afterEach(() => {
    rmSync(config.dataDir, { recursive: true, force: true })
  })

  describe('POST /api/notebooks/export', () => {
    it('returns a ZIP with .content, .metadata, and .local files', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: validBody,
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')

      const zip = unzipSync(new Uint8Array(res.rawPayload))
      const filenames = Object.keys(zip)

      // Default device is 'rm' (RM1/RM2) which does NOT need .rm stubs
      const metaFiles = filenames.filter(f => !f.includes('/'))
      const rmFiles = filenames.filter(f => f.endsWith('.rm'))
      expect(metaFiles).toHaveLength(3)
      expect(rmFiles).toHaveLength(0) // RM1/RM2 don't need .rm stubs
      expect(metaFiles.some(f => f.endsWith('.content'))).toBe(true)
      expect(metaFiles.some(f => f.endsWith('.metadata'))).toBe(true)
      expect(metaFiles.some(f => f.endsWith('.local'))).toBe(true)

      // All top-level files should share the same UUID prefix
      const uuids = metaFiles.map(f => f.split('.')[0])
      expect(new Set(uuids).size).toBe(1)

      await app.close()
    })

    it('content file has correct cPages v2 structure', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: validBody,
      })

      const zip = unzipSync(new Uint8Array(res.rawPayload))
      const contentFile = Object.entries(zip).find(([k]) => k.endsWith('.content'))!
      const content = JSON.parse(strFromU8(contentFile[1]))

      expect(content.fileType).toBe('notebook')
      expect(content.formatVersion).toBe(2)
      expect(content.pageCount).toBe(3)
      expect(content.cPages.pages).toHaveLength(3)
      expect(content.cPages.pages[0].template.value).toBe('Blank')
      expect(content.cPages.pages[1].template.value).toBe('Blank')
      expect(content.cPages.pages[2].template.value).toBe('66d2157c-test:p')
      expect(Array.isArray(content.cPages.uuids)).toBe(true)
      expect(content.cPages.original.value).toBe(-1)

      await app.close()
    })

    it('metadata file has DocumentType', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: validBody,
      })

      const zip = unzipSync(new Uint8Array(res.rawPayload))
      const metadataFile = Object.entries(zip).find(([k]) => k.endsWith('.metadata'))!
      const metadata = JSON.parse(strFromU8(metadataFile[1]))

      expect(metadata.type).toBe('DocumentType')
      expect(metadata.visibleName).toBe('Test Notebook')
      expect(metadata.version).toBe(0)
      expect(metadata.deleted).toBe(false)

      await app.close()
    })

    it('.local file has contentFormatVersion 2', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: validBody,
      })

      const zip = unzipSync(new Uint8Array(res.rawPayload))
      const localFile = Object.entries(zip).find(([k]) => k.endsWith('.local'))!
      const local = JSON.parse(strFromU8(localFile[1]))

      expect(local).toEqual({ contentFormatVersion: 2 })

      await app.close()
    })

    it('returns 400 for empty page groups', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: { name: 'Empty', pageGroups: [] },
      })
      expect(res.statusCode).toBe(400)

      await app.close()
    })

    it('returns 400 for missing name', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: { pageGroups: [{ id: 'g1', templateRef: 'Blank', templateName: 'Blank', count: 1 }] },
      })
      expect(res.statusCode).toBe(400)

      await app.close()
    })

    it('includes .rm stubs for PPM device', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: { ...validBody, deviceId: 'rmPPM' },
      })
      expect(res.statusCode).toBe(200)

      const zip = unzipSync(new Uint8Array(res.rawPayload))
      const filenames = Object.keys(zip)
      const rmFiles = filenames.filter(f => f.endsWith('.rm'))
      expect(rmFiles).toHaveLength(3) // PPM needs .rm stubs
      // Verify .rm stub size matches EMPTY_RM_FILE_SIZE (423 bytes)
      expect(zip[rmFiles[0]].length).toBe(423)

      await app.close()
    })

    it('returns 400 when all page groups have count 0', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: { name: 'Empty Pages', pageGroups: [{ id: 'g1', templateRef: 'Blank', templateName: 'Blank', count: 0 }] },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('returns 400 for invalid reuseUuid format', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: { ...validBody, reuseUuid: 'not-a-uuid' },
      })
      expect(res.statusCode).toBe(400)
      await app.close()
    })

    it('respects landscape orientation', async () => {
      const app = await createApp(config)
      const res = await app.inject({
        method: 'POST',
        url: '/api/notebooks/export',
        payload: { ...validBody, orientation: 'landscape' },
      })

      const zip = unzipSync(new Uint8Array(res.rawPayload))
      const contentFile = Object.entries(zip).find(([k]) => k.endsWith('.content'))!
      const content = JSON.parse(strFromU8(contentFile[1]))
      expect(content.orientation).toBe('landscape')

      await app.close()
    })
  })
})
