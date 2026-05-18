import type { Request } from 'express';
import type { AuthenticatedRequestContext } from './authenticated-request-context.type';
import type { AuthTokenPayload } from './auth-token-payload.type';

export interface AuthenticatedHttpRequest extends Request {
  user?: AuthTokenPayload;
  auth?: AuthenticatedRequestContext;
}
