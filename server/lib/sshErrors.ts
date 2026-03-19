/**
 * Maps raw SSH/network errors to user-friendly messages with troubleshooting hints.
 */

export interface FriendlyError {
  message: string
  hint: string
  rawError: string
}

const patterns: { test: RegExp; message: string; hint: string }[] = [
  {
    test: /EHOSTUNREACH/i,
    message: 'Could not reach your device',
    hint: 'Make sure your reMarkable is awake and on the same WiFi network. If using WiFi, the IP address may have changed — check Settings → General → Help → Copyrights and licenses on your device.',
  },
  {
    test: /ECONNREFUSED/i,
    message: 'Device refused the connection',
    hint: 'Your device may be restarting. Wait a moment and try again.',
  },
  {
    test: /ETIMEDOUT|readyTimeout/i,
    message: 'Connection timed out',
    hint: 'Make sure your reMarkable is awake and connected. If using WiFi, the IP address may have changed — check Settings → General → Help → Copyrights and licenses on your device.',
  },
  {
    test: /ECONNRESET/i,
    message: 'Connection was interrupted',
    hint: 'The device may have gone to sleep. Wake it and try again.',
  },
  {
    test: /All configured authentication methods failed|authentication/i,
    message: 'Authentication failed',
    hint: 'Your password or SSH key was rejected. If using password auth, the password resets on firmware updates — check Settings → General → Help → Copyrights and licenses for the current password. If using SSH keys, try switching back to password auth in Edit Connection.',
  },
  {
    test: /Cannot parse privateKey/i,
    message: 'Invalid SSH key',
    hint: 'The stored SSH key is corrupted. Use Edit Connection to switch back to password auth, then set up SSH keys again.',
  },
  {
    test: /No authentication method configured/i,
    message: 'No credentials configured',
    hint: 'Use Edit Connection to enter your device password.',
  },
]

export function formatSshError(raw: string | Error): FriendlyError {
  const rawStr = raw instanceof Error ? raw.message : raw

  for (const { test, message, hint } of patterns) {
    if (test.test(rawStr)) {
      return { message, hint, rawError: rawStr }
    }
  }

  return {
    message: 'Connection error',
    hint: 'Check that your device is awake and connected.',
    rawError: rawStr,
  }
}
