import { ValidationError } from '../../shared/errors.js'

export function createMatch({ id_profile1, id_profile2, data = new Date() }) {
  if (!id_profile1) throw new ValidationError('id_profile1 is required')
  if (!id_profile2) throw new ValidationError('id_profile2 is required')
  return { id_profile1, id_profile2, data }
}
