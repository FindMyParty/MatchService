import { NotFoundError } from '../../shared/errors.js'

export class FindMatchUseCase {
  /** @param {import('../ports/outbound/match-repository.js').IMatchRepository} matchRepository */
  constructor(matchRepository) {
    this.matchRepository = matchRepository
  }

  async execute(id_profile) {
    const matches = await this.matchRepository.findByProfileId(id_profile)
    if (!matches || matches.length === 0) throw new NotFoundError('Match')
    return matches
  }
}
