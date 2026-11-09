import { CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AdminTokenService } from '../../application/services/admin-token.service';
export declare class AdminTwoFactorSetupGuard implements CanActivate {
    private readonly tokens;
    private readonly prisma;
    constructor(tokens: AdminTokenService, prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
