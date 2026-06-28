const matchSchema = {
  type: 'object',
  properties: {
    id_profile1: { type: 'string' },
    id_profile2: { type: 'string' },
    data: { type: 'string', format: 'date-time' },
  },
};

export async function matchRoutes(fastify, { matchService }) {
  fastify.get('/matches/:id_profile', {
    schema: {
      params: {
        type: 'object',
        properties: { id_profile: { type: 'string' } },
        required: ['id_profile'],
      },
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: matchSchema } } } },
    },
    handler: async (request, reply) => {
      const { id_profile } = request.params;
      const matches = await matchService.findMatch(id_profile);
      return reply.status(200).send({ data: matches });
    },
  });
}
