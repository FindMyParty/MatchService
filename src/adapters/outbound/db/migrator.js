import { Kysely, Migrator, PostgresDialect } from 'kysely';
import pg from 'pg';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { promises as fs } from 'fs';
import { env } from '../../../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, '../../../migrations');

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: env.DATABASE_URL }),
  }),
});

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

const { error, results } = await migrator.migrateToLatest();

if (results) {
  for (const it of results) {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  }
}

if (error) {
  console.error('failed to migrate', error);
  await db.destroy();
  process.exit(1);
}

await db.destroy();
