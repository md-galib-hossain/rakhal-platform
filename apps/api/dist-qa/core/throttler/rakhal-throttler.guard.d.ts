import type { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { authConfig } from 'src/core/config/env';
export declare class RakhalThrottlerGuard extends ThrottlerGuard {
    private readonly jwt;
    private readonly auth;
    constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector, jwt: JwtService, auth: ConfigType<typeof authConfig>);
    protected getTracker(req: Record<string, unknown>): Promise<string>;
    private resolveTracker;
}
