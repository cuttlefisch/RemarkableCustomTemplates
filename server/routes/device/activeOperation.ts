/**
 * GET /api/devices/:id/active-operation — poll for in-progress or recently completed operations.
 */

import type { FastifyInstance } from 'fastify'
import type { ServerConfig } from '../../config.ts'
import { getActiveOperation } from '../../lib/operationTracker.ts'

export default function deviceActiveOperationRoutes(app: FastifyInstance, _config: ServerConfig) {
  app.get<{ Params: { id: string } }>('/api/devices/:id/active-operation', async (request, reply) => {
    const op = getActiveOperation(request.params.id)
    if (!op) {
      return reply.send({ active: false })
    }
    return reply.send({
      active: true,
      operationName: op.operationName,
      status: op.status,
      startedAt: op.startedAt,
      finishedAt: op.finishedAt,
      lastProgress: op.lastProgress,
      doneData: op.doneData,
      errorData: op.errorData,
    })
  })
}
