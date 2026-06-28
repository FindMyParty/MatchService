/**
 * @interface IUserStateRepository
 */

/**
 * @function addSuggestion
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<void>}
 */

/**
 * @function addSeen
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<void>}
 */

/**
 * @function addLiked
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<void>}
 */

/**
 * @function getSuggestions
 * @param {string} userId
 * @returns {Promise<string[]>}
 */

/**
 * @function getSeen
 * @param {string} userId
 * @returns {Promise<string[]>}
 */

/**
 * @function getLiked
 * @param {string} userId
 * @returns {Promise<string[]>}
 */

/**
 * @function isSuggested
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<boolean>}
 */

/**
 * @function hasSeen
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<boolean>}
 */

/**
 * @function hasLiked
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<boolean>}
 */

/**
 * @function removeSuggestion
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<void>}
 */

/**
 * @function removeLiked
 * @param {string} userId
 * @param {string} profileId
 * @returns {Promise<void>}
 */

/**
 * Adds suggestion IDs that are not already in the user's seen set.
 * Uses SDIFF for efficiency — single Redis round-trip regardless of list size.
 * @function addSuggestionsExcludingSeen
 * @param {string} userId
 * @param {string[]} suggestionIds
 * @returns {Promise<void>}
 */

/**
 * Atomically removes and returns up to `count` suggestion IDs (SPOP).
 * @function popSuggestions
 * @param {string} userId
 * @param {number} count
 * @returns {Promise<string[]>}
 */
