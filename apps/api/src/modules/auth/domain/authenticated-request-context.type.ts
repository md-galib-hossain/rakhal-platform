import { SessionStatus } from '@prisma/client';
import { AuthTokenPayload } from './auth-token-payload.type';

export interface AuthenticatedRequestAccount {
  id: string;
  email: string;
  name: string;
  permissionsVersion: number;
  isBlocked: boolean;
  deletedAt: Date | null;
}

export interface AuthenticatedRequestSession {
  id: string;
  userId: string;
  status: SessionStatus;
  expiresAt: Date;
  lastUsedAt: Date | null;
}

export interface AuthenticatedRequestContext {
  user: AuthTokenPayload;
  session: AuthenticatedRequestSession;
  account: AuthenticatedRequestAccount;
}
