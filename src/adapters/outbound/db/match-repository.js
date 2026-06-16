import { db } from './client.js';

export class MatchRepository {
  /**
   * @param {import('../../../domain/entities/match.js').Match} match
   */
  async save(match) {
    await db.insertInto('match_tb').values(match).execute();
  }

  async findAll() {
    return db.selectFrom('match_tb').selectAll().execute();
  }
}
