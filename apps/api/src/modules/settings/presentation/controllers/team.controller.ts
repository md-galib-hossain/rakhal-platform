import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { TeamService } from '../../application/services/team.service';
import { InviteTeamMemberDto } from '../dto/invite-team-member.dto';

/** Settings → Team (PRD §21.4 / API §18). `/api/v1/settings/team`. Token tenancy + RBAC. */
@Controller('settings/team')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermission('team.read')
  list(@CurrentFarmId() farmId: string) {
    return this.teamService.listTeam(farmId);
  }

  @Post('invite')
  @RequirePermission('team.invite')
  invite(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: InviteTeamMemberDto,
  ) {
    return this.teamService.invite(farmId, userId, dto);
  }

  @Post('invites/:id/resend')
  @RequirePermission('team.invite')
  resend(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.teamService.resendInvite(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('team.remove')
  remove(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.teamService.removeMember(farmId, userId, id);
  }
}
