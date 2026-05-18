export interface AuthTokenPayload {
  sub: string;
  sessionId: string;
  farmId: string;
  permissionsVersion: number;
}
