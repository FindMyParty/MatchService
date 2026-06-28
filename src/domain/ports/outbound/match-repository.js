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
 * Finds all matches where the given profile is either profile1 or profile2.
 * @function findByProfileId
 * @param {string} id_profile
 * @returns {Promise<Array<{ id_profile1: string, id_profile2: string, data: Date }>>}
 */
