import { createProfile } from '../entities/profile.js'
import { logger } from '../../shared/logger.js'

export class CreateProfileUseCase {
  /** @param {import('../ports/outbound/profile-repository.js').IProfileRepository} profileRepository */
  constructor(profileRepository) {
    this.profileRepository = profileRepository
  }

  async execute({ id_profile, name }) {
    const profile = createProfile({ id_profile, name })
    await this.profileRepository.save(profile)
    logger.info({ id_profile }, 'Profile created')
    return profile
  }
}
