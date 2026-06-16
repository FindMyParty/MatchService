/**
 * @interface IMatchService
 */

/**
 * Creates a match between two profiles.
 * @function createMatch
 * @param {{ id_profile1: string, id_profile2: string }} data
 * @returns {Promise<{ id_profile1: string, id_profile2: string, data: Date }>}
 */

/**
 * Returns all matches.
 * @function listMatches
 * @returns {Promise<Array<{ id_profile1: string, id_profile2: string, data: Date }>>}
 */
