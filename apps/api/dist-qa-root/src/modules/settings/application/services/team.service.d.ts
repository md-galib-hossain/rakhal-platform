import type { ConfigType } from '@nestjs/config';
import { emailConfig } from 'src/core/config/env';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { TransactionalEmailService } from 'src/modules/email/application/services/transactional-email.service';
import { InviteTeamMemberDto } from '../../presentation/dto/invite-team-member.dto';
import { ChangeMemberRoleDto } from '../../presentation/dto/change-member-role.dto';
export declare class TeamService {
    private readonly prisma;
    private readonly permissions;
    private readonly subscriptionAccess;
    private readonly txEmail;
    private readonly email;
    private readonly log;
    constructor(prisma: PrismaService, permissions: PermissionService, subscriptionAccess: SubscriptionAccessService, txEmail: TransactionalEmailService, email: ConfigType<typeof emailConfig>, logger: LoggerService);
    listTeam(farmId: string): Promise<{
        members: ({
            id: string;
            member_id: string;
            name: string;
            phone: null;
            email: string;
            role: string;
            status: string;
            last_active_at: Date | null;
            is_owner: boolean;
        } | {
            id: string;
            invite_id: string;
            name: string | null;
            phone: string | null;
            email: string;
            role: string;
            status: string;
            last_active_at: null;
            expires_at: Date;
        })[];
    }>;
    invite(farmId: string, userId: string, dto: InviteTeamMemberDto): Promise<{
        invite_id: string;
        sms_sent: boolean;
        expires_at: Date;
    }>;
    resendInvite(farmId: string, id: string): Promise<{
        invite_id: string;
        sms_sent: boolean;
        expires_at: Date;
    }>;
    revokeInvite(farmId: string, id: string): Promise<{
        id: string;
        revoked: boolean;
    }>;
    changeRole(farmId: string, requesterId: string, memberId: string, dto: ChangeMemberRoleDto): Promise<{
        id: string;
        role: string;
    }>;
    private sendInviteEmail;
    removeMember(farmId: string, requesterId: string, memberId: string): Promise<{
        id: string;
        removed: boolean;
    }>;
    private resolveRoleId;
}
