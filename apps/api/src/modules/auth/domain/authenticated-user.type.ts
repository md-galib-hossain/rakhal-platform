import { AuthTokenPayload } from './auth-token-payload.type';

export interface AuthenticatedUser extends AuthTokenPayload {
  email: string;
  name: string;
}
