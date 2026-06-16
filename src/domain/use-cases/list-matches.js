export class ListMatchesUseCase {
  /** @param {import('../ports/outbound/match-repository.js').IMatchRepository} matchRepository */
  constructor(matchRepository) {
    this.matchRepository = matchRepository
  }

  async execute() {
    return this.matchRepository.findAll()
  }
}
