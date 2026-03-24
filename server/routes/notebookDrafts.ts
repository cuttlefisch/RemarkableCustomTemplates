/**
 * Notebook draft CRUD routes.
 *
 * Persists notebook drafts in a versioned JSON store (`data/notebooks.json`).
 * Supports single-draft CRUD, batch import (for localStorage migration), and
 * fork (duplicate with new ID). Used by the notebook builder UI with optimistic
 * updates and 500ms debounced auto-save.
 *
 * Routes:
 * - `GET    /api/notebook-drafts`           -- list all drafts
 * - `POST   /api/notebook-drafts`           -- create one draft or batch-import `{ drafts: [...] }`
 * - `PUT    /api/notebook-drafts/:id`       -- update an existing draft
 * - `DELETE /api/notebook-drafts/:id`       -- delete a draft
 * - `DELETE /api/notebook-drafts`           -- delete ALL drafts (E2E test cleanup)
 * - `POST   /api/notebook-drafts/:id/fork`  -- duplicate a draft with a new ID
 *
 * @module
 */

import type { FastifyInstance } from 'fastify'
import type { ServerConfig } from '../config.ts'
import type { NotebookDraft } from '../../src/types/notebook.ts'
import {
  readNotebookStore,
  writeNotebookStore,
  upsertDraft,
  removeDraft,
  forkDraft,
} from '../lib/notebookDraftStore.ts'

/**
 * Registers notebook draft CRUD routes on the given Fastify instance.
 *
 * @param app - Fastify instance to register routes on
 * @param config - Resolved server configuration (provides `notebookDraftsPath`)
 */
export default function notebookDraftRoutes(app: FastifyInstance, config: ServerConfig) {
  const storePath = config.notebookDraftsPath

  /** List all drafts */
  app.get('/api/notebook-drafts', async () => {
    const store = readNotebookStore(storePath)
    return { drafts: store.drafts }
  })

  /** Delete ALL drafts (used by E2E test cleanup) */
  app.delete('/api/notebook-drafts', async () => {
    writeNotebookStore(storePath, { version: 1, drafts: [] })
    return { ok: true }
  })

  /** Create a single draft, or batch-import an array of drafts */
  app.post('/api/notebook-drafts', async (request, reply) => {
    const body = request.body as Record<string, unknown>

    // Batch import: { drafts: [...] }
    if (Array.isArray(body.drafts)) {
      const drafts = body.drafts as NotebookDraft[]
      const store = readNotebookStore(storePath)
      for (const draft of drafts) {
        if (!store.drafts.some(d => d.id === draft.id)) {
          store.drafts.push(draft)
        }
      }
      writeNotebookStore(storePath, store)
      return reply.status(201).send({ imported: drafts.length })
    }

    // Single draft
    const draft = body as unknown as NotebookDraft
    if (!draft.id || !draft.name || !draft.deviceId) {
      return reply.status(400).send({ error: 'Missing required fields: id, name, deviceId' })
    }

    upsertDraft(storePath, draft)
    return reply.status(201).send({ draft })
  })

  /** Update an existing draft */
  app.put<{ Params: { id: string } }>('/api/notebook-drafts/:id', async (request, reply) => {
    const { id } = request.params
    const store = readNotebookStore(storePath)
    if (!store.drafts.some(d => d.id === id)) {
      return reply.status(404).send({ error: `Draft ${id} not found` })
    }

    const draft = request.body as NotebookDraft
    // Ensure the URL param id matches the body
    draft.id = id
    upsertDraft(storePath, draft)
    return { draft }
  })

  /** Delete a draft */
  app.delete<{ Params: { id: string } }>('/api/notebook-drafts/:id', async (request, reply) => {
    const { id } = request.params
    const store = readNotebookStore(storePath)
    if (!store.drafts.some(d => d.id === id)) {
      return reply.status(404).send({ error: `Draft ${id} not found` })
    }

    removeDraft(storePath, id)
    return { ok: true }
  })

  /** Fork (duplicate) a draft */
  app.post<{ Params: { id: string } }>('/api/notebook-drafts/:id/fork', async (request, reply) => {
    const { id } = request.params
    const body = (request.body ?? {}) as Record<string, unknown>
    const customName = body.name as string | undefined

    const forked = forkDraft(storePath, id, customName)
    if (!forked) {
      return reply.status(404).send({ error: `Draft ${id} not found` })
    }

    return reply.status(201).send({ draft: forked })
  })
}
