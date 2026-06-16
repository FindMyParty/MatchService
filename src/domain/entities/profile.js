import { ValidationError } from '../../shared/errors.js'

export function createProfile({ id_profile, name }) {
  if (!id_profile) throw new ValidationError('id_profile is required')
  if (!name) throw new ValidationError('name is required')
  return { id_profile, name }
}
