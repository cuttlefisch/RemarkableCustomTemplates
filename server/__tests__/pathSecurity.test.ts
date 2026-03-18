// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { assertWithin } from '../lib/pathSecurity.ts'

describe('assertWithin', () => {
  it('allows paths within the base directory', () => {
    expect(() => assertWithin('/base/dir', '/base/dir/file.txt')).not.toThrow()
  })

  it('allows the base directory itself', () => {
    expect(() => assertWithin('/base/dir', '/base/dir')).not.toThrow()
  })

  it('rejects paths outside the base directory', () => {
    expect(() => assertWithin('/base/dir', '/other/dir/file.txt')).toThrow('Path traversal attempt rejected')
  })

  it('rejects path traversal with ..', () => {
    // resolve() would already resolve the .., but assertWithin checks the result
    expect(() => assertWithin('/base/dir', '/base/file.txt')).toThrow('Path traversal attempt rejected')
  })

  it('rejects paths that are prefixes but not subdirectories', () => {
    // "/base/directory" starts with "/base/dir" but is not inside "/base/dir/"
    expect(() => assertWithin('/base/dir', '/base/directory')).toThrow('Path traversal attempt rejected')
  })
})
