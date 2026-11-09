import { TeamService } from '../../application/services/team.service';
import { InviteTeamMemberDto } from '../dto/invite-team-member.dto';
import { ChangeMemberRoleDto } from '../dto/change-member-role.dto';
export declare class TeamController {
    private readonly teamService;
    constructor(teamService: TeamService);
    list(farmId: string): Promise<{
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
    resend(farmId: string, id: string): Promise<{
        invite_id: string;
        sms_sent: boolean;
        expires_at: Date;
    }>;
    revokeInvite(farmId: string, id: string): Promise<{
        id: string;
        revoked: boolean;
    }>;
    changeRole(farmId: string, userId: string, id: string, dto: ChangeMemberRoleDto): Promise<{
        id: string;
        role: string;
    }>;
    remove(farmId: string, userId: string, id: string): Promise<{
        id: string;
        removed: boolean;
    }>;
}
