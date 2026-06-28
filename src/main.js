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
const { Migrator, sql } = await import('kysely');
const { fileURLToPath, pathToFileURL } = await import('url');
const { default: path } = await import('path');
const { promises: fs } = await import('fs');

await sql`SELECT 1`.execute(db);
logger.info('Database connected');

// Step 4: Run migrations
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, './migrations');

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      const files = (await fs.readdir(migrationsFolder)).filter((f) => f.endsWith('.js'));
      const entries = await Promise.all(
        files.map(async (file) => {
          const mod = await import(pathToFileURL(path.join(migrationsFolder, file)).href);
          return [file.replace(/\.js$/, ''), mod];
        }),
      );
      return Object.fromEntries(entries);
    },
  },
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
const { registerSubscribers, registerSwipeSubscriber, registerSuggestionsSubscriber } = await import('./adapters/inbound/messaging/subscriber.js');

const profileRepository = new ProfileRepository();
await registerSubscribers(channel, profileRepository);

// Step 7b: Connect Redis
logger.info('Connecting to Redis...');
const { redisClient } = await import('./adapters/outbound/cache/redis-client.js');
await redisClient.connect();
logger.info('Redis connected');

// Step 8: Instantiate repositories and application service
const { MatchRepository } = await import('./adapters/outbound/db/match-repository.js');
const { UserStateRepository } = await import('./adapters/outbound/cache/user-state-repository.js');
const { MatchApplicationService } = await import('./application/services/match-application-service.js');

const matchRepository = new MatchRepository();
const userStateRepository = new UserStateRepository(redisClient, env.REDIS_TTL);
const matchService = new MatchApplicationService(matchRepository, eventPublisher, userStateRepository);

// Step 8b: Register swipe subscriber (needs matchRepository + userStateRepository)
await registerSwipeSubscriber(channel, userStateRepository, matchRepository, eventPublisher)

// Step 8c: Register suggestions subscriber
await registerSuggestionsSubscriber(channel, userStateRepository);

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

    await redisClient.quit();
    logger.info('Redis connection closed');

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
