import { RegisteredUser } from './registered-user.type';

export interface LoginResult {
  user: RegisteredUser;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}
