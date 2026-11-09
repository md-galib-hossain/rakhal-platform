export declare const PASSWORD_RESET_REQUESTED_EVENT = "auth.password.reset_requested";
export interface PasswordResetRequestedEvent {
    userId: string;
    email: string;
    name: string;
    token: string;
    tenantId: string;
    farmId: string | null;
    correlationId?: string;
}
