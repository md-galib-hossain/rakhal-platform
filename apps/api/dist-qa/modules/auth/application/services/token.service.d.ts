import { JwtService } from '@nestjs/jwt';
import { AuthTokenPayload } from 'src/modules/auth/domain/auth-token-payload.type';
export declare class TokenService {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    signAccessToken(payload: AuthTokenPayload): Promise<string>;
}
