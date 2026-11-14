import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { SubscriptionFeatureGuard } from 'src/modules/subscription/presentation/guards/subscription-feature.guard';
import { RequireFeature } from 'src/modules/subscription/presentation/decorators/require-feature.decorator';
import { ScoreboardService } from '../../application/services/scoreboard.service';
import { JoinScoreboardDto } from '../dto/join-scoreboard.dto';
import { LeaderboardQueryDto } from '../dto/leaderboard-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Scoreboard (PRD §18 / API §14, RAKHAL-206). `/api/v1/scoreboard`. Token tenancy
 * + RBAC: view = `scoreboard.read` (Owner/Manager); join/leave = `scoreboard.join`
 * (Owner only). **Subscription gate:** Scoreboard is a Pro feature
 * (`scoreboard.read`, RAKHAL-219). The leaderboard is cross-tenant but reads only
 * opted-in farms.
 */
@ApiTags('Scoreboard')
@ApiBearerAuth()
@Controller('scoreboard')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
  SubscriptionFeatureGuard,
)
@RequireFeature('scoreboard.read')
export class ScoreboardController {
  constructor(private readonly scoreboard: ScoreboardService) {}

  @Get('highlights')
  @RequirePermission('scoreboard.read')
  highlights(@CurrentFarmId() farmId: string) {
    return this.scoreboard.highlights(farmId);
  }

  @Get('leaderboard')
  @RequirePermission('scoreboard.read')
  leaderboard(
    @CurrentFarmId() farmId: string,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.scoreboard.leaderboard(farmId, query);
  }

  @Post('join')
  @RequirePermission('scoreboard.join')
  join(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: JoinScoreboardDto,
  ) {
    return this.scoreboard.join(farmId, userId, dto);
  }

  @Delete('join')
  @RequirePermission('scoreboard.join')
  leave(@CurrentFarmId() farmId: string) {
    return this.scoreboard.leave(farmId);
  }
}
