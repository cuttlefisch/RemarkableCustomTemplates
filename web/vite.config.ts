/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Serve the Python template data directory at /templates/ so the browser
    // can fetch individual .template files by name without bundling them all.
    viteStaticCopy({
      targets: [
        {
          src: '../python/src/customtemplates/data/*',
          dest: 'templates',
        },
      ],
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
