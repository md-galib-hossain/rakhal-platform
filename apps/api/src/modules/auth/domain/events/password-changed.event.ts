export const PASSWORD_CHANGED_EVENT = 'auth.password.changed';

export interface PasswordChangedEvent {
  userId: string;
  tenantId: string;
  farmId: string | null;
  correlationId?: string;
}
