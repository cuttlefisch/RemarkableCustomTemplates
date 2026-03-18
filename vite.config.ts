import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// API routes are served by the Fastify server (server/index.ts).
// In dev mode, Vite proxies /api/* and /templates/* to the Fastify server.
// Template files in public/templates/custom/ are served by Vite's static middleware.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/templates': {
        target: 'http://localhost:3001',
        // Don't proxy /templates/custom/ — Vite serves those from public/
        bypass(req) {
          if (req.url?.startsWith('/templates/custom/')) return req.url
        },
      },
    },
  },
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
