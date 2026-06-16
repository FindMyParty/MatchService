import { UnauthorizedError } from '../../../../shared/errors.js';

export async function authMiddleware(request, reply) {
  const authorization = request.headers['authorization'];

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError();
  }

  request.user = { id: 'system', token };
}
