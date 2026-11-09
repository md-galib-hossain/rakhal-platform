import { CanActivate, ExecutionContext } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class AdminIpAllowlistGuard implements CanActivate {
    private readonly log;
    constructor(logger: LoggerService);
    canActivate(context: ExecutionContext): boolean;
}
