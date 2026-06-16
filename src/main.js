import { initTelemetry, shutdownTelemetry } from './shared/telemetry.js';

// Step 1: OTel must start before other modules load so instrumentation patches apply
initTelemetry();

// Step 2: Validate env (dynamic import ensures telemetry is active first)
const { env } = await import('./config/env.js');
const { logger } = await import('./shared/logger.js');

// Initialize Sentry early so it captures errors during the rest of the boot sequence
if (env.SENTRY_DSN) {
  const Sentry = await import('@sentry/node');
  Sentry.init({ dsn: env.SENTRY_DSN });
  logger.info('Sentry initialized');
}

// Step 3: Connect DB
logger.info('Connecting to database...');
const { db } = await import('./adapters/outbound/db/client.js');
const { Migrator, FileMigrationProvider, sql } = await import('kysely');
const { fileURLToPath } = await import('url');
const { default: path } = await import('path');
const { promises: fs } = await import('fs');

await sql`SELECT 1`.execute(db);
logger.info('Database connected');

// Step 4: Run migrations
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, './migrations'),
  }),
});

const { error: migrationError, results: migrationResults } = await migrator.migrateToLatest();

if (migrationResults) {
  for (const it of migrationResults) {
    if (it.status === 'Success') {
      logger.info({ migration: it.migrationName }, 'Migration applied successfully');
    } else if (it.status === 'Error') {
      logger.error({ migration: it.migrationName }, 'Migration failed');
    }
  }
}

if (migrationError) {
  logger.error({ err: migrationError }, 'Failed to run migrations');
  await db.destroy();
  process.exit(1);
}

logger.info('Migrations applied');

// Step 5: Connect RabbitMQ
logger.info('Connecting to RabbitMQ...');
const { default: amqplib } = await import('amqplib');
const amqpConnection = await amqplib.connect(env.RABBITMQ_URL);
const channel = await amqpConnection.createChannel();
logger.info('RabbitMQ connected');

// Step 6: Instantiate publisher and connect to channel
const { RabbitMQEventPublisher } = await import('./adapters/outbound/messaging/publisher.js');
const eventPublisher = new RabbitMQEventPublisher();
eventPublisher.connect(channel);

// Step 7: Register subscribers
const { ProfileRepository } = await import('./adapters/outbound/db/profile-repository.js');
const { CreateProfileUseCase } = await import('./domain/use-cases/create-profile.js');
const { registerSubscribers } = await import('./adapters/inbound/messaging/subscriber.js');

const profileRepository = new ProfileRepository();
const createProfileUseCase = new CreateProfileUseCase(profileRepository);
await registerSubscribers(channel, createProfileUseCase);

// Step 8: Instantiate repositories and application service
const { MatchRepository } = await import('./adapters/outbound/db/match-repository.js');
const { MatchApplicationService } = await import('./application/services/match-application-service.js');

const matchRepository = new MatchRepository();
const matchService = new MatchApplicationService(profileRepository, matchRepository, eventPublisher);

// Step 9: Start HTTP server
const { buildServer } = await import('./adapters/inbound/http/server.js');
const server = buildServer(matchService);

await server.listen({ port: Number(env.PORT), host: '0.0.0.0' });
logger.info({ port: env.PORT }, `HTTP server listening on port ${env.PORT}`);

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');
  try {
    await server.close();
    logger.info('HTTP server closed');

    await amqpConnection.close();
    logger.info('RabbitMQ connection closed');

    await db.destroy();
    logger.info('Database connection closed');

    await shutdownTelemetry();
    logger.info('Telemetry shut down');

    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
