import { z, ZodError } from 'zod'
import { ValidationError } from '../../../../shared/errors.js'

const swipeBodySchema = z.object({
  targetId: z.string().uuid(),
  liked: z.boolean(),
})

export async function swipeRoutes(fastify, { matchService }) {
  fastify.post('/swipes', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-user-id'],
        properties: { 'x-user-id': { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        required: ['targetId', 'liked'],
        properties: {
          targetId: { type: 'string', format: 'uuid' },
          liked: { type: 'boolean' },
        },
      },
      response: { 202: { type: 'object' } },
    },
    handler: async (request, reply) => {
      const requesterId = request.headers['x-user-id']

      let body
      try {
        body = swipeBodySchema.parse(request.body)
      } catch (err) {
        if (err instanceof ZodError) {
          throw new ValidationError(err.errors.map((e) => e.message).join(', '))
        }
        throw err
      }

      await matchService.swipe({ requesterId, ...body })
      return reply.status(202).send({})
    },
  })
}
