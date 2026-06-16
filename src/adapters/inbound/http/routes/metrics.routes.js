export async function metricsRoutes(fastify) {
  fastify.get('/metrics', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      mode: 'push',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });
  });
}
