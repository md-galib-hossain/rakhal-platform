export declare const EMAIL_VERIFICATION_TOKEN_PORT: unique symbol;
export interface EmailVerificationTokenPort {
    createEmailVerificationToken(data: {
        userId: string;
        token: string;
        expiresAt: Date;
    }): Promise<unknown>;
}
