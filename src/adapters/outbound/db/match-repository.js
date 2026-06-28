import { db } from './client.js';

export class MatchRepository {
  /**
   * @param {import('../../../domain/entities/match.js').Match} match
   */
  async save(match) {
    await db.insertInto('match_tb').values(match).execute();
  }

  async findByProfileId(id_profile) {
    return db
      .selectFrom('match_tb')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb('id_profile1', '=', id_profile),
          eb('id_profile2', '=', id_profile),
        ])
      )
      .execute();
  }
}
