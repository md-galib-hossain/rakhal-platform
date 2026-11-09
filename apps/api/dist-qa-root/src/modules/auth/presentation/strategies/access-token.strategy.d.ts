import type { ConfigType } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { authConfig } from 'src/core/config/env';
import { AuthTokenPayload } from '../../domain/auth-token-payload.type';
declare const AccessTokenStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class AccessTokenStrategy extends AccessTokenStrategy_base {
    constructor(config: ConfigType<typeof authConfig>);
    validate(payload: AuthTokenPayload): AuthTokenPayload;
}
export {};
