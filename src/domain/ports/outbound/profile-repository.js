/**
 * @interface IProfileRepository
 */

/**
 * Persists a profile.
 * @function save
 * @param {{ id_profile: string, name: string }} profile
 * @returns {Promise<void>}
 */

/**
 * Finds a profile by its ID.
 * @function findById
 * @param {string} id_profile
 * @returns {Promise<{ id_profile: string, name: string } | null>}
 */
