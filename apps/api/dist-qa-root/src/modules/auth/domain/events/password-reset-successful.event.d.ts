export declare const PASSWORD_RESET_SUCCESSFUL_EVENT = "auth.password.reset_successful";
export interface PasswordResetSuccessfulEvent {
    userId: string;
    tenantId: string;
    farmId: string | null;
    correlationId?: string;
}
