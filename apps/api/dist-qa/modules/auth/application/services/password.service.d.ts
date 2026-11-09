import type { ConfigType } from '@nestjs/config';
import { authConfig } from 'src/core/config/env';
export declare class PasswordService {
    private readonly config;
    constructor(config: ConfigType<typeof authConfig>);
    hashPassword(plainPassword: string): Promise<string>;
    verifyPassword(hash: string, plainPassword: string): Promise<boolean>;
}
