import { z, ZodError } from 'zod'
import { ValidationError } from '../../../../shared/errors.js'

const suggestionsQuerySchema = z.object({
  count: z.coerce.number().int().min(1),
})

export async function suggestionsRoutes(fastify, { matchService }) {
  fastify.get('/suggestions', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-user-id'],
        properties: { 'x-user-id': { type: 'string', minLength: 1 } },
      },
      querystring: {
        type: 'object',
        required: ['count'],
        properties: { count: { type: 'integer', minimum: 1 } },
      },
      response: {
        200: {
          type: 'object',
          properties: { data: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = request.headers['x-user-id']

      let query
      try {
        query = suggestionsQuerySchema.parse(request.query)
      } catch (err) {
        if (err instanceof ZodError) {
          throw new ValidationError(err.errors.map((e) => e.message).join(', '))
        }
        throw err
      }

      const suggestions = await matchService.getSuggestionsAndRemove(userId, query.count)
      return reply.status(200).send({ data: suggestions })
    },
  })
}
