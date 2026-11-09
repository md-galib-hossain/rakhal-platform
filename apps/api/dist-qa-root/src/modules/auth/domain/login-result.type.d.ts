import { RegisteredUser } from './registered-user.type';
export interface LoginFarmSummary {
    id: string;
    name: string;
    slug: string;
    role: string;
}
export interface LoginResult {
    user: RegisteredUser;
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    farmId: string;
    needsFarm: boolean;
    farms?: LoginFarmSummary[];
}
