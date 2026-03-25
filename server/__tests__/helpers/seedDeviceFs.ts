/**
 * Seed a fake reMarkable filesystem inside a temp directory for SSH integration tests.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

/** Create the base reMarkable directory structure. */
export function seedBaseFs(fsRoot: string) {
  mkdirSync(resolve(fsRoot, 'home/root/.local/share/remarkable/xochitl'), { recursive: true })
  mkdirSync(resolve(fsRoot, 'home/root/.ssh'), { recursive: true })
  mkdirSync(resolve(fsRoot, 'home/root/template-backups'), { recursive: true })
  mkdirSync(resolve(fsRoot, 'usr/share/remarkable/templates'), { recursive: true })
  mkdirSync(resolve(fsRoot, 'sys/devices/soc0'), { recursive: true })
  writeFileSync(resolve(fsRoot, 'sys/devices/soc0/machine'), 'reMarkable 2.0\n')
  mkdirSync(resolve(fsRoot, 'etc'), { recursive: true })
  writeFileSync(resolve(fsRoot, 'etc/os-release'), 'ID=codex\nIMG_VERSION="3.26.0.68"\n')
}

/** Write UUID triplets (.template, .metadata, .content) + device manifest to the xochitl dir. */
export function seedMethodsTemplates(
  fsRoot: string,
  templates: Array<{ uuid: string; name: string; contentHash?: string; version?: string }>,
) {
  const xochitlDir = resolve(fsRoot, 'home/root/.local/share/remarkable/xochitl')
  const manifestTemplates: Record<string, { name: string; templateVersion: string; contentHash: string; createdTime: string }> = {}

  for (const t of templates) {
    const tplContent = JSON.stringify({ name: t.name, items: [], constants: [] })
    writeFileSync(resolve(xochitlDir, `${t.uuid}.template`), tplContent)
    writeFileSync(resolve(xochitlDir, `${t.uuid}.metadata`), JSON.stringify({
      type: 'TemplateType',
      visibleName: t.name,
      lastModified: String(Date.now()),
    }))
    writeFileSync(resolve(xochitlDir, `${t.uuid}.content`), '{}')
    manifestTemplates[t.uuid] = {
      name: t.name,
      templateVersion: t.version ?? '1.0.0',
      contentHash: t.contentHash ?? `sha256:${t.uuid}`,
      createdTime: String(Date.now()),
    }
  }

  writeFileSync(
    resolve(xochitlDir, '.remarkable-templates-deployed'),
    JSON.stringify({ exportedAt: String(Date.now()), templates: manifestTemplates }, null, 2),
  )
}

/** Write classic templates (templates.json + .template files) to /usr/share/remarkable/templates/. */
export function seedClassicTemplates(
  fsRoot: string,
  entries: Array<{ filename: string; name: string }>,
) {
  const templatesDir = resolve(fsRoot, 'usr/share/remarkable/templates')
  const registry = {
    templates: entries.map(e => ({
      name: e.name,
      filename: e.filename,
      iconCode: '\ue9d8',
      landscape: false,
      categories: ['Lines'],
    })),
  }
  writeFileSync(resolve(templatesDir, 'templates.json'), JSON.stringify(registry, null, 2))
  for (const entry of entries) {
    writeFileSync(resolve(templatesDir, `${entry.filename}.template`), JSON.stringify({ name: entry.name }))
  }
}

/** Options for seedXoviFs(). */
export interface SeedXoviOptions {
  xovi?: boolean           // default true — create xovi.so
  qtRebuilder?: boolean    // default true — create qt-resource-rebuilder.so
  vellum?: boolean         // default true — create vellum binary
  qmdFiles?: string[]      // default [] — QMD filenames to seed in qmdDir
  reenableNeeded?: boolean // default false — create vellum reenable marker
}

/** Seed xovi framework files on mock device filesystem. */
export function seedXoviFs(fsRoot: string, opts: SeedXoviOptions = {}) {
  const { xovi = true, qtRebuilder = true, vellum = true, qmdFiles = [], reenableNeeded = false } = opts
  const xoviDir = resolve(fsRoot, 'home/root/xovi')
  const qmdDir = resolve(xoviDir, 'exthome/qt-resource-rebuilder')

  mkdirSync(resolve(xoviDir, 'extensions.d'), { recursive: true })
  mkdirSync(qmdDir, { recursive: true })

  if (xovi) writeFileSync(resolve(xoviDir, 'xovi.so'), '')
  if (qtRebuilder) writeFileSync(resolve(xoviDir, 'extensions.d/qt-resource-rebuilder.so'), '')
  writeFileSync(resolve(xoviDir, 'rebuild_hashtable'), '')

  if (vellum) {
    const vellumDir = resolve(fsRoot, 'home/root/.vellum/bin')
    mkdirSync(vellumDir, { recursive: true })
    writeFileSync(resolve(vellumDir, 'vellum'), '')
  }

  for (const qmd of qmdFiles) {
    writeFileSync(resolve(qmdDir, qmd), 'mock-qmd-content')
  }

  if (reenableNeeded) {
    const markerDir = resolve(fsRoot, 'home/root/.vellum')
    mkdirSync(markerDir, { recursive: true })
    writeFileSync(resolve(markerDir, '.reenable-needed'), '')
  }
}

/** Options for seedNotebook(). */
export interface SeedNotebookOptions {
  visibleName?: string     // default 'Test Notebook'
  pageCount?: number       // default 3
  deleted?: boolean        // default false
  modifiedRmFiles?: number // default 0 — count of .rm files > 423 bytes (simulates user edits)
}

/** Seed a notebook UUID on the mock device filesystem (metadata, content, page dir). */
export function seedNotebook(fsRoot: string, uuid: string, opts: SeedNotebookOptions = {}) {
  const { visibleName = 'Test Notebook', pageCount = 3, deleted = false, modifiedRmFiles = 0 } = opts
  const xochitlDir = resolve(fsRoot, 'home/root/.local/share/remarkable/xochitl')
  const pageDir = resolve(xochitlDir, uuid)
  mkdirSync(pageDir, { recursive: true })

  // .metadata
  writeFileSync(resolve(xochitlDir, `${uuid}.metadata`), JSON.stringify({
    type: 'DocumentType',
    visibleName,
    deleted,
    lastModified: String(Date.now()),
    version: 1,
  }))

  // .content (cPages v2 style)
  const pageIds = Array.from({ length: pageCount }, () => randomUUID())
  writeFileSync(resolve(xochitlDir, `${uuid}.content`), JSON.stringify({
    fileType: 'notebook',
    formatVersion: 2,
    pageCount,
    cPages: { pages: pageIds.map(id => ({ id })) },
  }))

  // Optional .rm files — first `modifiedRmFiles` are large (modified), rest are stubs
  for (let i = 0; i < pageCount; i++) {
    const size = i < modifiedRmFiles ? 1024 : 0 // > 423 = modified
    if (size > 0) {
      writeFileSync(resolve(pageDir, `${pageIds[i]}.rm`), Buffer.alloc(size, 0x42))
    }
  }
}
