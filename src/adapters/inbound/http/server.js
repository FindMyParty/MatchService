import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { logger } from '../../../shared/logger.js';
import { AppError } from '../../../shared/errors.js';
import { matchRoutes } from './routes/match.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { metricsRoutes } from './routes/metrics.routes.js';

export function buildServer(matchService) {
  const fastify = Fastify({ logger });

  fastify.register(cors);
  fastify.register(helmet);

  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
    }

    fastify.log.error(error);
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  fastify.register(healthRoutes);
  fastify.register(metricsRoutes);
  fastify.register(matchRoutes, { matchService });

  return fastify;
}
