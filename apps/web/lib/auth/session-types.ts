export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
}

export interface Session {
  accessToken: string;
  farmId: string;
  sessionId: string;
  user: SessionUser;
}
