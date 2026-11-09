export declare const emailConfig: (() => {
    provider: "resend" | "smtp";
    from: string;
    verificationBaseUrl: string;
    passwordResetBaseUrl: string;
    inviteBaseUrl: string;
    verificationTokenTtlMinutes: number;
    resendApiKey: string | undefined;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    provider: "resend" | "smtp";
    from: string;
    verificationBaseUrl: string;
    passwordResetBaseUrl: string;
    inviteBaseUrl: string;
    verificationTokenTtlMinutes: number;
    resendApiKey: string | undefined;
}>;
