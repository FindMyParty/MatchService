import { ValidationError } from '../../shared/errors.js'

export class SwipeUseCase {
  constructor(eventPublisher) {
    this.eventPublisher = eventPublisher
  }

  async execute({ requesterId, targetId, liked }) {
    if (requesterId === targetId) {
      throw new ValidationError('Cannot swipe on yourself')
    }
    await this.eventPublisher.publish('match.swipe.created', { requesterId, targetId, liked })
  }
}
