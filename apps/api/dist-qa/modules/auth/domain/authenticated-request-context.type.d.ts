import { SessionStatus } from '@prisma/client';
import { AuthTokenPayload } from './auth-token-payload.type';
import { AppLanguage } from 'src/common/i18n/language';
export interface AuthenticatedRequestAccount {
    id: string;
    email: string;
    name: string;
    permissionsVersion: number;
    isBlocked: boolean;
    deletedAt: Date | null;
    preferredLanguage: AppLanguage;
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
