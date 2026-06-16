export async function up(db) {
  await db.schema
    .createTable('profile')
    .ifNotExists()
    .addColumn('id_profile', 'varchar', (col) => col.primaryKey().notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .execute();
}

export async function down(db) {
  await db.schema.dropTable('profile').ifExists().execute();
}
