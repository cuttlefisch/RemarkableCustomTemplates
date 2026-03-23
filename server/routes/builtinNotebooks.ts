/**
 * Built-in notebook routes — virtual notebooks generated from template registries.
 * Hide/restore uses same pattern as sampleTemplates.ts.
 */

import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ServerConfig } from '../config.ts'
import { generateBuiltinNotebook } from '../lib/builtinNotebooks.ts'
import type { NotebookDraft } from '../../src/types/notebook.ts'

function readHidden(path: string): string[] {
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}

function writeHidden(path: string, hidden: string[]): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(hidden, null, 2))
}

export default function builtinNotebookRoutes(app: FastifyInstance, config: ServerConfig) {
  /** GET /api/builtin-notebooks — returns non-hidden built-in notebooks */
  app.get('/api/builtin-notebooks', async () => {
    const hidden = readHidden(config.hiddenNotebooksPath)
    const notebooks: NotebookDraft[] = []

    const sample = generateBuiltinNotebook(
      config.samplesRegistry,
      '__sample-notebook__',
      'Sample Notebook',
      'sample',
    )
    if (sample && !hidden.includes(sample.id)) {
      notebooks.push(sample)
    }

    const debug = generateBuiltinNotebook(
      config.debugRegistry,
      '__debug-notebook__',
      'Debug Notebook',
      'debug',
    )
    if (debug && !hidden.includes(debug.id)) {
      notebooks.push(debug)
    }

    return { notebooks }
  })

  /** GET /api/builtin-notebooks/hidden — returns hidden notebook IDs */
  app.get('/api/builtin-notebooks/hidden', async () => {
    const hidden = readHidden(config.hiddenNotebooksPath)
    return { hidden }
  })

  /** POST /api/builtin-notebooks/hide — hide a notebook by ID */
  app.post('/api/builtin-notebooks/hide', async (request, reply) => {
    const { id } = request.body as { id?: string }
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'id is required' })
    }
    const hidden = readHidden(config.hiddenNotebooksPath)
    if (!hidden.includes(id)) {
      hidden.push(id)
      writeHidden(config.hiddenNotebooksPath, hidden)
    }
    return { ok: true, hidden }
  })

  /** POST /api/builtin-notebooks/restore-all — clear hidden list */
  app.post('/api/builtin-notebooks/restore-all', async () => {
    const hidden = readHidden(config.hiddenNotebooksPath)
    const count = hidden.length
    writeHidden(config.hiddenNotebooksPath, [])
    return { ok: true, restored: count }
  })
}
