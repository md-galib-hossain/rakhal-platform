export const USER_REGISTERED_EVENT = 'auth.user.registered';

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  farmId: string | null;
  correlationId?: string;
}
