/**
 * Server entry point. Starts Fastify on the configured port.
 */

import { createApp } from './app.ts'
import { resolveConfig } from './config.ts'

const config = resolveConfig()

const app = await createApp(config)

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`Server listening on port ${config.port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
