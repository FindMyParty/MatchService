/**
 * @interface IMatchRepository
 */

/**
 * Persists a match.
 * @function save
 * @param {{ id_profile1: string, id_profile2: string, data: Date }} match
 * @returns {Promise<void>}
 */

/**
 * Returns all matches.
 * @function findAll
 * @returns {Promise<Array<{ id_profile1: string, id_profile2: string, data: Date }>>}
 */
