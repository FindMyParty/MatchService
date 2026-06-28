export class GetSuggestionsUseCase {
  /**
   * @param {import('../ports/outbound/user-state-repository.js').IUserStateRepository} userStateRepository
   */
  constructor(userStateRepository) {
    this.userStateRepository = userStateRepository
  }

  /**
   * @param {{ userId: string, count: number }} param
   * @returns {Promise<string[]>}
   */
  async execute({ userId, count }) {
    return this.userStateRepository.popSuggestions(userId, count)
  }
}
