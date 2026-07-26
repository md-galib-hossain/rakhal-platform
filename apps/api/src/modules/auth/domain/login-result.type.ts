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
  /** The token's active farm — `""` when the caller has no farm yet or (2+
   * memberships, `farmId` omitted) hasn't picked one. */
  farmId: string;
  needsFarm: boolean;
  /** Present only when `farmId` was omitted from the request and the caller
   * has 2+ memberships — lets the client pick without a second `GET /farms`. */
  farms?: LoginFarmSummary[];
}
