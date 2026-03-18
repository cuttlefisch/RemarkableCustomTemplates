// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseManifestUuids, mergeDeployedUuids } from '../lib/deviceManifest.ts'

describe('deviceManifest', () => {
  describe('parseManifestUuids', () => {
    it('extracts sorted UUIDs from valid manifest JSON', () => {
      const json = JSON.stringify({
        exportedAt: '1710672000000',
        templates: {
          'ccc-uuid': { name: 'C' },
          'aaa-uuid': { name: 'A' },
          'bbb-uuid': { name: 'B' },
        },
      })
      expect(parseManifestUuids(json)).toEqual(['aaa-uuid', 'bbb-uuid', 'ccc-uuid'])
    })

    it('returns empty array for invalid JSON', () => {
      expect(parseManifestUuids('not json')).toEqual([])
    })

    it('returns empty array for empty string', () => {
      expect(parseManifestUuids('')).toEqual([])
    })

    it('returns empty array for JSON without templates key', () => {
      expect(parseManifestUuids('{}')).toEqual([])
    })

    it('returns empty array for empty templates object', () => {
      const json = JSON.stringify({ exportedAt: '0', templates: {} })
      expect(parseManifestUuids(json)).toEqual([])
    })
  })

  describe('mergeDeployedUuids', () => {
    it('returns union of two UUID arrays, sorted and deduplicated', () => {
      const local = ['aaa', 'bbb', 'ccc']
      const device = ['bbb', 'ddd']
      expect(mergeDeployedUuids(local, device)).toEqual(['aaa', 'bbb', 'ccc', 'ddd'])
    })

    it('handles one empty array', () => {
      expect(mergeDeployedUuids([], ['xxx', 'yyy'])).toEqual(['xxx', 'yyy'])
      expect(mergeDeployedUuids(['xxx', 'yyy'], [])).toEqual(['xxx', 'yyy'])
    })

    it('handles both empty arrays', () => {
      expect(mergeDeployedUuids([], [])).toEqual([])
    })

    it('handles identical arrays', () => {
      expect(mergeDeployedUuids(['aaa', 'bbb'], ['aaa', 'bbb'])).toEqual(['aaa', 'bbb'])
    })
  })
})
