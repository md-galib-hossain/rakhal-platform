import type { Request } from 'express';
import type { AuthenticatedRequestContext } from './authenticated-request-context.type';
import type { AuthTokenPayload } from './auth-token-payload.type';
import type { VerifiedFarmContext } from 'src/modules/tenant-access/domain/verified-farm-context.type';

export interface AuthenticatedHttpRequest extends Request {
  user?: AuthTokenPayload;
  auth?: AuthenticatedRequestContext;
  farm?: VerifiedFarmContext;
}
