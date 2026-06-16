import { db } from './client.js';

export class ProfileRepository {
  /**
   * @param {import('../../../domain/entities/profile.js').Profile} profile
   */
  async save(profile) {
    await db
      .insertInto('profile')
      .values(profile)
      .onConflict((oc) => oc.column('id_profile').doNothing())
      .execute();
  }

  /**
   * @param {string} id_profile
   */
  async findById(id_profile) {
    return db
      .selectFrom('profile')
      .selectAll()
      .where('id_profile', '=', id_profile)
      .executeTakeFirst();
  }
}
