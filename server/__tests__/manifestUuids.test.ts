// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { readManifestUuids, countManifestUuids, diffManifestUuids } from '../lib/manifestUuids.ts'

describe('manifestUuids', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = resolve(tmpdir(), `manifest-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('readManifestUuids', () => {
    it('reads UUIDs from JSON manifest', () => {
      const manifest = {
        exportedAt: '123',
        templates: {
          'uuid-aaa': { name: 'A' },
          'uuid-ccc': { name: 'C' },
          'uuid-bbb': { name: 'B' },
        },
      }
      const path = resolve(tmpDir, '.manifest')
      writeFileSync(path, JSON.stringify(manifest))
      const uuids = readManifestUuids(path)
      expect(uuids).toEqual(['uuid-aaa', 'uuid-bbb', 'uuid-ccc'])
    })

    it('reads UUIDs from plain-text format', () => {
      const path = resolve(tmpDir, 'legacy.txt')
      writeFileSync(path, 'uuid-bbb\nuuid-aaa\n\nuuid-ccc\n')
      const uuids = readManifestUuids(path)
      expect(uuids).toEqual(['uuid-aaa', 'uuid-bbb', 'uuid-ccc'])
    })

    it('returns empty array for non-existent file', () => {
      expect(readManifestUuids('/no/such/file')).toEqual([])
    })

    it('returns empty array for empty file', () => {
      const path = resolve(tmpDir, 'empty')
      writeFileSync(path, '')
      expect(readManifestUuids(path)).toEqual([])
    })
  })

  describe('countManifestUuids', () => {
    it('counts templates in manifest', () => {
      const manifest = { exportedAt: '123', templates: { a: {}, b: {}, c: {} } }
      const path = resolve(tmpDir, '.manifest')
      writeFileSync(path, JSON.stringify(manifest))
      expect(countManifestUuids(path)).toBe(3)
    })
  })

  describe('diffManifestUuids', () => {
    it('returns UUIDs in old but not in new', () => {
      const oldManifest = { exportedAt: '1', templates: { a: {}, b: {}, c: {} } }
      const newManifest = { exportedAt: '2', templates: { b: {}, d: {} } }
      const oldPath = resolve(tmpDir, 'old.json')
      const newPath = resolve(tmpDir, 'new.json')
      writeFileSync(oldPath, JSON.stringify(oldManifest))
      writeFileSync(newPath, JSON.stringify(newManifest))
      expect(diffManifestUuids(oldPath, newPath)).toEqual(['a', 'c'])
    })

    it('returns empty array when all UUIDs preserved', () => {
      const manifest = { exportedAt: '1', templates: { a: {} } }
      const path = resolve(tmpDir, 'same.json')
      writeFileSync(path, JSON.stringify(manifest))
      expect(diffManifestUuids(path, path)).toEqual([])
    })
  })
})
