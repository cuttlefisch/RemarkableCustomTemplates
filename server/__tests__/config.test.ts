// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { resolveConfig } from '../config.ts'
import { resolve } from 'node:path'

describe('resolveConfig', () => {
  it('uses cwd as default dataDir', () => {
    const config = resolveConfig({ dataDir: '/test/dir' })
    expect(config.dataDir).toBe('/test/dir')
  })

  it('derives all paths from dataDir', () => {
    const config = resolveConfig({ dataDir: '/data' })
    expect(config.officialDir).toBe(resolve('/data', 'remarkable_official_templates'))
    expect(config.customDir).toBe(resolve('/data', 'public/templates/custom'))
    expect(config.customRegistry).toBe(resolve('/data', 'public/templates/custom/custom-registry.json'))
    expect(config.debugDir).toBe(resolve('/data', 'public/templates/debug'))
    expect(config.debugRegistry).toBe(resolve('/data', 'public/templates/debug/debug-registry.json'))
    expect(config.methodsDir).toBe(resolve('/data', 'public/templates/methods'))
    expect(config.methodsRegistry).toBe(resolve('/data', 'public/templates/methods/methods-registry.json'))
    expect(config.rmMethodsDistDir).toBe(resolve('/data', 'rm-methods-dist'))
    expect(config.rmMethodsBackupDir).toBe(resolve('/data', 'rm-methods-backups'))
    expect(config.deviceConfigPath).toBe(resolve('/data', 'data/device-config.json'))
    expect(config.sshDir).toBe(resolve('/data', 'data/ssh'))
  })

  it('defaults port to 3001 in dev', () => {
    const config = resolveConfig({ dataDir: '/data', production: false })
    expect(config.port).toBe(3001)
  })

  it('defaults port to 3000 in production', () => {
    const config = resolveConfig({ dataDir: '/data', production: true, port: 3000 })
    expect(config.port).toBe(3000)
  })

  it('respects port override', () => {
    const config = resolveConfig({ dataDir: '/data', port: 8080 })
    expect(config.port).toBe(8080)
  })
})
