import { sql } from 'kysely';

export async function up(db) {
  await sql`
    CREATE TABLE IF NOT EXISTS match_tb (
      id_profile1 VARCHAR NOT NULL REFERENCES profile(id_profile),
      id_profile2 VARCHAR NOT NULL REFERENCES profile(id_profile),
      data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id_profile1, id_profile2)
    )
  `.execute(db);
}

export async function down(db) {
  await db.schema.dropTable('match_tb').ifExists().execute();
}
