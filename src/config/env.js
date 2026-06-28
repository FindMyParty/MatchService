import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().min(1),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
  SENTRY_DSN: z.string().optional(),
  REDIS_URL: z.string().min(1),
  REDIS_TTL: z.coerce.number().int().positive().default(86400),

  // RabbitMQ — profile events (ProfileService → match-service)
  RABBITMQ_PROFILE_EXCHANGE: z.string().min(1).default('profile.events'),
  RABBITMQ_PROFILE_QUEUE: z.string().min(1).default('match-service.profile.profile'),
  RABBITMQ_PROFILE_BINDING_KEY: z.string().min(1).default('profile.profile.*'),

  // RabbitMQ — swipe events (match-service → itself)
  RABBITMQ_SWIPE_EXCHANGE: z.string().min(1).default('match'),
  RABBITMQ_SWIPE_QUEUE: z.string().min(1).default('match-service.match.swipe'),
  RABBITMQ_SWIPE_BINDING_KEY: z.string().min(1).default('match.swipe.*'),

  // RabbitMQ — suggestion events (Discovery Engine → match-service)
  RABBITMQ_SUGGESTION_EXCHANGE: z.string().min(1).default('suggestion'),
  RABBITMQ_SUGGESTION_QUEUE: z.string().min(1).default('match-service.discovery.suggestion'),
  RABBITMQ_SUGGESTION_BINDING_KEY: z.string().min(1).default('discovery.suggestion.*'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`[env] Missing or invalid environment variables:\n${missing}`);
  process.exit(1);
}

export const env = parsed.data;
