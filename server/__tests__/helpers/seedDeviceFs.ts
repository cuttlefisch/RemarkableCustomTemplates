/**
 * Seed a fake reMarkable filesystem inside a temp directory for SSH integration tests.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
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
