import type { ConfigType } from '@nestjs/config';
import type { CookieOptions } from 'express';
import { authConfig } from '../config/env';
type AuthConfig = ConfigType<typeof authConfig>;
export declare function getRefreshCookieOptions(config: AuthConfig): CookieOptions;
export declare function getClearRefreshCookieOptions(config: AuthConfig): CookieOptions;
export declare function getCsrfCookieOptions(config: AuthConfig): CookieOptions;
export {};
