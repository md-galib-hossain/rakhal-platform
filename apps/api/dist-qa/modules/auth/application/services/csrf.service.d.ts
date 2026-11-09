import type { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import { authConfig } from 'src/core/config/env';
import type { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';
export declare class CsrfService {
    private readonly config;
    private readonly utilities;
    constructor(config: ConfigType<typeof authConfig>);
    generateToken(request: AuthenticatedHttpRequest, response: Response): string;
    validateRequest(request: AuthenticatedHttpRequest): boolean;
    private getSessionIdentifier;
}
