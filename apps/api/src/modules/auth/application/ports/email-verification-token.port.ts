export const EMAIL_VERIFICATION_TOKEN_PORT = Symbol(
  'EMAIL_VERIFICATION_TOKEN_PORT',
);

export interface EmailVerificationTokenPort {
  createEmailVerificationToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<unknown>;
}
