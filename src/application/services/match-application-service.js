import { FindMatchUseCase } from '../../domain/use-cases/find-match.js'
import { SwipeUseCase } from '../../domain/use-cases/swipe.js'
import { GetSuggestionsUseCase } from '../../domain/use-cases/get-suggestions.js'

/**
 * @implements {import('../../domain/ports/inbound/match-service.js').IMatchService}
 */
export class MatchApplicationService {
  /**
   * @param {import('../../domain/ports/outbound/match-repository.js').IMatchRepository} matchRepository
   * @param {import('../../domain/ports/outbound/event-publisher.js').IEventPublisher} eventPublisher
   * @param {import('../../domain/ports/outbound/user-state-repository.js').IUserStateRepository} userStateRepository
   */
  constructor(matchRepository, eventPublisher, userStateRepository) {
    this.matchRepository = matchRepository
    this.eventPublisher = eventPublisher
    this.userStateRepository = userStateRepository
  }

  async findMatch(id_profile) {
    const useCase = new FindMatchUseCase(this.matchRepository)
    return useCase.execute(id_profile)
  }

  async swipe({ requesterId, targetId, liked }) {
    const useCase = new SwipeUseCase(this.eventPublisher)
    return useCase.execute({ requesterId, targetId, liked })
  }

  async getSuggestionsAndRemove(userId, count) {
    const useCase = new GetSuggestionsUseCase(this.userStateRepository)
    return useCase.execute({ userId, count })
  }

  async addSuggestion(userId, profileId) {
    return this.userStateRepository.addSuggestion(userId, profileId)
  }

  async addSeen(userId, profileId) {
    return this.userStateRepository.addSeen(userId, profileId)
  }

  async addLiked(userId, profileId) {
    return this.userStateRepository.addLiked(userId, profileId)
  }

  async getSuggestions(userId) {
    return this.userStateRepository.getSuggestions(userId)
  }

  async getSeen(userId) {
    return this.userStateRepository.getSeen(userId)
  }

  async getLiked(userId) {
    return this.userStateRepository.getLiked(userId)
  }

  async isSuggested(userId, profileId) {
    return this.userStateRepository.isSuggested(userId, profileId)
  }

  async hasSeen(userId, profileId) {
    return this.userStateRepository.hasSeen(userId, profileId)
  }

  async hasLiked(userId, profileId) {
    return this.userStateRepository.hasLiked(userId, profileId)
  }
}
