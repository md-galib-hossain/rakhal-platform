import { AdminTokenPayload } from '../../domain/admin-token-payload.type';
type JwtDuration = `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`;
export declare class AdminTokenService {
    private readonly jwt;
    private readonly secret;
    private readonly expiresIn;
    sign(payload: AdminTokenPayload, expiresIn?: JwtDuration): Promise<string>;
    verify(token: string): Promise<AdminTokenPayload>;
}
export {};
