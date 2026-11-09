import { AdminSupportActionsService } from '../../application/services/admin-support-actions.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminSendPasswordResetDto, AdminSupportActionDto } from '../dto/admin-support-action.dto';
export declare class AdminSupportActionsController {
    private readonly actions;
    constructor(actions: AdminSupportActionsService);
    suspendFarm(admin: CurrentAdminContext, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        status: "ACTIVE" | "SUSPENDED";
        changed: boolean;
    }>;
    reactivateFarm(admin: CurrentAdminContext, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        status: "ACTIVE" | "SUSPENDED";
        changed: boolean;
    }>;
    blockUser(admin: CurrentAdminContext, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        isBlocked: boolean;
        changed: boolean;
    }>;
    unblockUser(admin: CurrentAdminContext, id: string, dto: AdminSupportActionDto): Promise<{
        id: string;
        isBlocked: boolean;
        changed: boolean;
    }>;
    sendPasswordReset(admin: CurrentAdminContext, id: string, dto: AdminSendPasswordResetDto): Promise<{
        id: string;
        sent: boolean;
        revokedSessions: number;
    }>;
    revokeSessions(admin: CurrentAdminContext, id: string, dto: AdminSupportActionDto): Promise<{
        revokedSessions: number;
        revokedRefreshTokens: number;
        success: boolean;
    }>;
}
