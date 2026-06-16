import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { env } from '../../../config/env.js';

/**
 * @typedef {Object} ProfileTable
 * @property {string} id_profile
 * @property {string} name
 */

/**
 * @typedef {Object} MatchTbTable
 * @property {string} id_profile1
 * @property {string} id_profile2
 * @property {Date} data
 */

/**
 * @typedef {Object} Database
 * @property {ProfileTable} profile
 * @property {MatchTbTable} match_tb
 */

/** @type {Kysely<Database>} */
export const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: env.DATABASE_URL }),
  }),
});
