// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { formatSshError } from '../lib/sshErrors.ts'

describe('formatSshError', () => {
  describe('known error patterns', () => {
    it('handles EHOSTUNREACH', () => {
      const result = formatSshError('connect EHOSTUNREACH 10.11.99.1:22')
      expect(result.message).toBe('Could not reach your device')
      expect(result.hint).toContain('same WiFi network')
    })

    it('handles ECONNREFUSED', () => {
      const result = formatSshError('connect ECONNREFUSED 10.11.99.1:22')
      expect(result.message).toBe('Device refused the connection')
      expect(result.hint).toContain('restarting')
    })

    it('handles ETIMEDOUT', () => {
      const result = formatSshError('connect ETIMEDOUT 10.11.99.1:22')
      expect(result.message).toBe('Connection timed out')
      expect(result.hint).toContain('awake and connected')
    })

    it('handles readyTimeout', () => {
      const result = formatSshError('Timed out while waiting for handshake (readyTimeout)')
      expect(result.message).toBe('Connection timed out')
      expect(result.hint).toContain('IP address may have changed')
    })

    it('handles ECONNRESET', () => {
      const result = formatSshError('read ECONNRESET')
      expect(result.message).toBe('Connection was interrupted')
      expect(result.hint).toContain('gone to sleep')
    })

    it('handles authentication failure', () => {
      const result = formatSshError('All configured authentication methods failed')
      expect(result.message).toBe('Authentication failed')
      expect(result.hint).toContain('password or SSH key was rejected')
    })

    it('handles generic authentication error', () => {
      const result = formatSshError('Keyboard-interactive authentication failed')
      expect(result.message).toBe('Authentication failed')
      expect(result.hint).toContain('SSH keys')
    })

    it('handles invalid privateKey', () => {
      const result = formatSshError('Cannot parse privateKey: unsupported format')
      expect(result.message).toBe('Invalid SSH key')
      expect(result.hint).toContain('corrupted')
    })

    it('handles no auth configured (shadowed by auth pattern)', () => {
      // "No authentication method configured" contains "authentication", so the
      // broader auth-failure pattern (/authentication/i) matches first. This
      // documents the current priority behavior.
      const result = formatSshError('No authentication method configured')
      expect(result.message).toBe('Authentication failed')
      expect(result.hint).toContain('password or SSH key was rejected')
    })
  })

  describe('fallback for unknown errors', () => {
    it('returns generic connection error for unrecognized message', () => {
      const result = formatSshError('Something completely unexpected happened')
      expect(result.message).toBe('Connection error')
      expect(result.hint).toBe('Check that your device is awake and connected.')
    })
  })

  describe('input types', () => {
    it('accepts a string input', () => {
      const result = formatSshError('connect EHOSTUNREACH 10.11.99.1:22')
      expect(result.message).toBe('Could not reach your device')
      expect(result.rawError).toBe('connect EHOSTUNREACH 10.11.99.1:22')
    })

    it('accepts an Error input', () => {
      const err = new Error('connect ECONNREFUSED 10.11.99.1:22')
      const result = formatSshError(err)
      expect(result.message).toBe('Device refused the connection')
      expect(result.rawError).toBe('connect ECONNREFUSED 10.11.99.1:22')
    })
  })

  describe('rawError field', () => {
    it('preserves original string message', () => {
      const raw = 'connect ETIMEDOUT 192.168.1.1:22'
      const result = formatSshError(raw)
      expect(result.rawError).toBe(raw)
    })

    it('preserves Error.message for Error inputs', () => {
      const err = new Error('some unknown error')
      const result = formatSshError(err)
      expect(result.rawError).toBe('some unknown error')
    })

    it('preserves rawError even for fallback/unknown errors', () => {
      const raw = 'totally unrecognized problem'
      const result = formatSshError(raw)
      expect(result.rawError).toBe(raw)
    })
  })
})
