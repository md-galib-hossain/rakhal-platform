import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { AuthService } from 'src/modules/auth/application/services/auth.service';
import { AdminSendPasswordResetDto, AdminSupportActionDto } from '../../presentation/dto/admin-support-action.dto';
import { AdminAuditService } from './admin-audit.service';
export declare class AdminSupportActionsService {
    private readonly prisma;
    private readonly auth;
    private readonly audit;
    constructor(prisma: PrismaService, auth: AuthService, audit: AdminAuditService);
    suspendFarm(actorId: string, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        status: "ACTIVE" | "SUSPENDED";
        changed: boolean;
    }>;
    reactivateFarm(actorId: string, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        status: "ACTIVE" | "SUSPENDED";
        changed: boolean;
    }>;
    private setFarmStatus;
    blockUser(actorId: string, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        isBlocked: boolean;
        changed: boolean;
    }>;
    unblockUser(actorId: string, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        isBlocked: boolean;
        changed: boolean;
    }>;
    sendPasswordReset(actorId: string, id: string, dto: AdminSendPasswordResetDto): Promise<{
        id: string;
        sent: boolean;
        revokedSessions: number;
    }>;
    revokeUserSessions(actorId: string, id: string, dto: AdminSupportActionDto): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
    private getUser;
    private assertConfirm;
}
