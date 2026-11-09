import { CanActivate, ExecutionContext } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuthRepository } from '../../infrastructure/persistence/repositories/auth.repository';
import { PermissionsVersionCacheService } from '../../application/services/permissions-version-cache.service';
export declare class SessionGuard implements CanActivate {
    private readonly authRepository;
    private readonly permissionsVersionCache;
    private readonly logger;
    private readonly log;
    constructor(authRepository: AuthRepository, permissionsVersionCache: PermissionsVersionCacheService, logger: LoggerService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
