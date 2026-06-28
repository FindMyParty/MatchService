/**
 * @implements {import('../../../domain/ports/outbound/user-state-repository.js').IUserStateRepository}
 */
export class UserStateRepository {
  /**
   * @param {import('ioredis').Redis} client
   * @param {number} ttl - TTL in seconds
   */
  constructor(client, ttl) {
    this.client = client
    this.ttl = ttl
  }

  async addSuggestion(userId, profileId) {
    await this.client.sadd(`suggestions:${userId}`, profileId)
    await this.client.expire(`suggestions:${userId}`, this.ttl)
  }

  async addSeen(userId, profileId) {
    await this.client.sadd(`seen:${userId}`, profileId)
    await this.client.expire(`seen:${userId}`, this.ttl)
  }

  async addLiked(userId, profileId) {
    await this.client.sadd(`liked:${userId}`, profileId)
    await this.client.expire(`liked:${userId}`, this.ttl)
  }

  async getSuggestions(userId) {
    return this.client.smembers(`suggestions:${userId}`)
  }

  async getSeen(userId) {
    return this.client.smembers(`seen:${userId}`)
  }

  async getLiked(userId) {
    return this.client.smembers(`liked:${userId}`)
  }

  async isSuggested(userId, profileId) {
    const result = await this.client.sismember(`suggestions:${userId}`, profileId)
    return result === 1
  }

  async hasSeen(userId, profileId) {
    const result = await this.client.sismember(`seen:${userId}`, profileId)
    return result === 1
  }

  async hasLiked(userId, profileId) {
    const result = await this.client.sismember(`liked:${userId}`, profileId)
    return result === 1
  }

  async removeSuggestion(userId, profileId) {
    await this.client.srem(`suggestions:${userId}`, profileId)
  }

  async removeLiked(userId, profileId) {
    await this.client.srem(`liked:${userId}`, profileId)
  }

  async addSuggestionsExcludingSeen(userId, suggestionIds) {
    if (!suggestionIds.length) return
    const tempKey = `temp:sugg:${userId}:${Date.now()}`
    await this.client.sadd(tempKey, ...suggestionIds)
    await this.client.expire(tempKey, 60)
    const nonSeen = await this.client.sdiff(tempKey, `seen:${userId}`)
    await this.client.del(tempKey)
    if (nonSeen.length > 0) {
      await this.client.sadd(`suggestions:${userId}`, ...nonSeen)
      await this.client.expire(`suggestions:${userId}`, this.ttl)
    }
  }

  async popSuggestions(userId, count) {
    return this.client.spop(`suggestions:${userId}`, count)
  }
}
