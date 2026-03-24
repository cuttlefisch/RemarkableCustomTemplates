/**
 * Server entry point.
 *
 * Resolves configuration from environment variables, creates the Fastify app
 * via {@link createApp}, and starts listening on `0.0.0.0:{port}`. In dev mode
 * (port 3001), Vite proxies `/api/*` and `/templates/*` here; in production
 * (port 3000), this process serves both API and static frontend.
 *
 * @module
 */

import { createApp } from './app.ts'
import { resolveConfig } from './config.ts'

const config = resolveConfig()

const app = await createApp(config)

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
  console.log('')
  console.log(`  RM Custom Templates`)
  console.log(`  ➜ http://localhost:${config.port}`)
  console.log('')
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
