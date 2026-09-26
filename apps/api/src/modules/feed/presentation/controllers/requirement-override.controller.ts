import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { SubscriptionFeatureGuard } from 'src/modules/subscription/presentation/guards/subscription-feature.guard';
import { RequireFeature } from 'src/modules/subscription/presentation/decorators/require-feature.decorator';
import { RequirementOverrideService } from '../../application/services/requirement-override.service';
import { SetRequirementOverrideDto } from '../dto/set-requirement-override.dto';
import { RequirementOverrideHistoryQueryDto } from '../dto/requirement-override-history-query.dto';

/**
 * A cow's manual nutrition requirement (MILESTONE 28, RAKHAL-462). `/api/v1/feed/cattle/:cattleId/…`.
 * Read = worker-ok (`feed.read`); set / turn off = `feed.update` (manager+).
 */
@ApiTags('Feed')
@ApiBearerAuth()
@Controller('feed/cattle/:cattleId')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
  SubscriptionFeatureGuard,
)
@RequireFeature('feed.formulator')
export class RequirementOverrideController {
  constructor(private readonly overrides: RequirementOverrideService) {}

  /** `{ active, resolved, last }` — `last` is the newest closed row, to pre-fill "turn back on". */
  @Get('requirement-override')
  @RequirePermission('feed.read')
  get(@CurrentFarmId() farmId: string, @Param('cattleId') cattleId: string) {
    return this.overrides.get(farmId, cattleId);
  }

  /** History, newest first, cursor-paginated. Each row carries the calculated figures at the time. */
  @Get('requirement-overrides')
  @RequirePermission('feed.read')
  history(
    @CurrentFarmId() farmId: string,
    @Param('cattleId') cattleId: string,
    @Query() query: RequirementOverrideHistoryQueryDto,
  ) {
    return this.overrides.history(farmId, cattleId, query);
  }

  /** Turn manual on, or replace the values: closes the open row and opens a new one in one transaction. */
  @Put('requirement-override')
  @RequirePermission('feed.update')
  set(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('cattleId') cattleId: string,
    @Body() dto: SetRequirementOverrideDto,
  ) {
    return this.overrides.set(farmId, userId, cattleId, dto);
  }

  /** Turn manual off — her calculated requirement applies again from now. */
  @Delete('requirement-override')
  @RequirePermission('feed.update')
  turnOff(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('cattleId') cattleId: string,
  ) {
    return this.overrides.turnOff(farmId, userId, cattleId);
  }
}
