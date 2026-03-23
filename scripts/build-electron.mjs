/**
 * Bundle Electron main + preload via esbuild.
 * Produces dist-electron/main.mjs and dist-electron/preload.mjs.
 *
 * All package.json dependencies are marked external — electron-builder
 * ships them via node_modules. Only project code (server/, src/lib/,
 * src/types/, electron/) gets bundled.
 */

import { build } from 'esbuild'
import { readFileSync, mkdirSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const external = [
  ...Object.keys(pkg.dependencies || {}),
  'electron',
]

mkdirSync('dist-electron', { recursive: true })

// Main process — includes server code
await build({
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external,
  sourcemap: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})

// Preload script
await build({
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist-electron/preload.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['electron'],
  sourcemap: true,
})

console.log('Electron bundle built → dist-electron/')
