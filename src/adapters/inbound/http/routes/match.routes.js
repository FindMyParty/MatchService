import { z, ZodError } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { ValidationError } from '../../../../shared/errors.js';

const createMatchSchema = z.object({
  id_profile1: z.string().min(1),
  id_profile2: z.string().min(1),
});

export async function matchRoutes(fastify, { matchService }) {
  fastify.post('/matches', { preHandler: authMiddleware }, async (request, reply) => {
    let body;
    try {
      body = createMatchSchema.parse(request.body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map((e) => e.message).join(', '));
      }
      throw err;
    }
    const match = await matchService.createMatch(body);
    return reply.status(201).send({ data: match });
  });

  fastify.get('/matches', { preHandler: authMiddleware }, async (request, reply) => {
    const matches = await matchService.listMatches();
    return reply.status(200).send({ data: matches });
  });
}
