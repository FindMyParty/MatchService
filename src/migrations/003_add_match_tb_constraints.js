import { sql } from 'kysely';

export async function up(db) {
  await sql`ALTER TABLE match_tb DROP CONSTRAINT IF EXISTS match_tb_id_profile1_fkey`.execute(db);
  await sql`ALTER TABLE match_tb DROP CONSTRAINT IF EXISTS match_tb_id_profile2_fkey`.execute(db);

  await sql`
    ALTER TABLE match_tb
      ADD CONSTRAINT fk_match_profile1
        FOREIGN KEY (id_profile1) REFERENCES profile(id_profile) ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE match_tb
      ADD CONSTRAINT fk_match_profile2
        FOREIGN KEY (id_profile2) REFERENCES profile(id_profile) ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE match_tb
      ADD CONSTRAINT ck_match_ordering
        CHECK (id_profile1 < id_profile2)
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_match_tb_profile1 ON match_tb(id_profile1)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_match_tb_profile2 ON match_tb(id_profile2)`.execute(db);
}

export async function down(db) {
  await sql`DROP INDEX IF EXISTS idx_match_tb_profile2`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_match_tb_profile1`.execute(db);
  await sql`ALTER TABLE match_tb DROP CONSTRAINT IF EXISTS ck_match_ordering`.execute(db);
  await sql`ALTER TABLE match_tb DROP CONSTRAINT IF EXISTS fk_match_profile2`.execute(db);
  await sql`ALTER TABLE match_tb DROP CONSTRAINT IF EXISTS fk_match_profile1`.execute(db);
  await sql`ALTER TABLE match_tb ADD FOREIGN KEY (id_profile1) REFERENCES profile(id_profile)`.execute(db);
  await sql`ALTER TABLE match_tb ADD FOREIGN KEY (id_profile2) REFERENCES profile(id_profile)`.execute(db);
}
