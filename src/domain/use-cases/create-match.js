import { createMatch } from '../entities/match.js'
import { ValidationError } from '../../shared/errors.js'
import { logger } from '../../shared/logger.js'

export class CreateMatchUseCase {
  /**
   * @param {import('../ports/outbound/match-repository.js').IMatchRepository} matchRepository
   * @param {import('../ports/outbound/event-publisher.js').IEventPublisher} eventPublisher
   */
  constructor(matchRepository, eventPublisher) {
    this.matchRepository = matchRepository
    this.eventPublisher = eventPublisher
  }

  async execute({ id_profile1, id_profile2 }) {
    if (id_profile1 === id_profile2) {
      throw new ValidationError('id_profile1 and id_profile2 must be different')
    }
    const match = createMatch({ id_profile1, id_profile2, data: new Date() })
    await this.matchRepository.save(match)
    await this.eventPublisher.publish('match.match.created', match)
    logger.info({ id_profile1, id_profile2 }, 'Match created')
    return match
  }
}
