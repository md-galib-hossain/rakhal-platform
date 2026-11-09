import { CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { AdminTokenService } from '../../application/services/admin-token.service';
import { AdminSessionService } from '../../application/services/admin-session.service';
export declare class PlatformAdminGuard implements CanActivate {
    private readonly tokens;
    private readonly prisma;
    private readonly sessions;
    private readonly requestContext;
    private readonly log;
    constructor(tokens: AdminTokenService, prisma: PrismaService, sessions: AdminSessionService, requestContext: LoggerContext, logger: LoggerService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
