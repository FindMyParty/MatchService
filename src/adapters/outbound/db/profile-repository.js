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

  async upsert(profile) {
    await db
      .insertInto('profile')
      .values(profile)
      .onConflict((oc) =>
        oc.column('id_profile').doUpdateSet({ name: profile.name }),
      )
      .execute();
  }

}
