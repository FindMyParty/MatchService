import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().min(1),
  DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url(),
  SENTRY_DSN: z.string().optional(),
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
