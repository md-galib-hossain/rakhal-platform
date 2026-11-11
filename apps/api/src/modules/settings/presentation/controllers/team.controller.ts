import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { TeamService } from '../../application/services/team.service';
import { InviteTeamMemberDto } from '../dto/invite-team-member.dto';
import { ChangeMemberRoleDto } from '../dto/change-member-role.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  TeamChangeRoleResponseDto,
  TeamInviteResponseDto,
  TeamListResponseDto,
  TeamRemoveMemberResponseDto,
  TeamRevokeInviteResponseDto,
} from '../dto/settings-response.dto';

/** Settings â†’ Team (PRD Â§21.4 / API Â§18). `/api/v1/settings/team`. Token tenancy + RBAC. */
@ApiTags('Team')
@ApiBearerAuth()
@Controller('settings/team')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermission('team.read')
  @ApiEnvelopeResponse(TeamListResponseDto)
  list(@CurrentFarmId() farmId: string) {
    return this.teamService.listTeam(farmId);
  }

  @Post('invite')
  @RequirePermission('team.invite')
  @ApiEnvelopeResponse(TeamInviteResponseDto, { status: 201 })
  invite(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: InviteTeamMemberDto,
  ) {
    return this.teamService.invite(farmId, userId, dto);
  }

  @Post('invites/:id/resend')
  @RequirePermission('team.invite')
  @ApiEnvelopeResponse(TeamInviteResponseDto, { status: 201 })
  resend(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.teamService.resendInvite(farmId, id);
  }

  @Delete('invites/:id')
  @RequirePermission('team.invite')
  @ApiEnvelopeResponse(TeamRevokeInviteResponseDto)
  revokeInvite(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.teamService.revokeInvite(farmId, id);
  }

  @Patch(':id/role')
  @RequirePermission('team.invite')
  @ApiEnvelopeResponse(TeamChangeRoleResponseDto)
  changeRole(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.teamService.changeRole(farmId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('team.remove')
  @ApiEnvelopeResponse(TeamRemoveMemberResponseDto)
  remove(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.teamService.removeMember(farmId, userId, id);
  }
}
