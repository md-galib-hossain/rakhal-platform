export declare class AdminTotpService {
    generateSecret(): string;
    buildOtpAuthUrl(email: string, secretBase32: string): string;
    currentCode(secretBase32: string): string;
    private hotp;
    verify(secretBase32: string, token: string, window?: number): boolean;
}
