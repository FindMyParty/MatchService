import { CreateMatchUseCase } from '../../domain/use-cases/create-match.js'
import { ListMatchesUseCase } from '../../domain/use-cases/list-matches.js'

/**
 * @implements {import('../../domain/ports/inbound/match-service.js').IMatchService}
 */
export class MatchApplicationService {
  /**
   * @param {import('../../domain/ports/outbound/profile-repository.js').IProfileRepository} profileRepository
   * @param {import('../../domain/ports/outbound/match-repository.js').IMatchRepository} matchRepository
   * @param {import('../../domain/ports/outbound/event-publisher.js').IEventPublisher} eventPublisher
   */
  constructor(profileRepository, matchRepository, eventPublisher) {
    this.profileRepository = profileRepository
    this.matchRepository = matchRepository
    this.eventPublisher = eventPublisher
  }

  async createMatch(data) {
    const useCase = new CreateMatchUseCase(this.matchRepository, this.eventPublisher)
    return useCase.execute(data)
  }

  async listMatches() {
    const useCase = new ListMatchesUseCase(this.matchRepository)
    return useCase.execute()
  }
}
