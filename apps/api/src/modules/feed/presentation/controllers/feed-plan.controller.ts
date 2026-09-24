import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { FeedPlanService } from '../../application/services/feed-plan.service';
import { FeedPlanAssignmentService } from '../../application/services/feed-plan-assignment.service';
import {
  ApplyFeedPlanDto,
  ArchiveFeedPlanQueryDto,
  CreateFeedPlanDto,
  FeedPlanFitQueryDto,
  ListFeedPlansQueryDto,
  UpdateFeedPlanDto,
} from '../dto/feed-plan.dto';

/**
 * Feed Plans (MILESTONE 27, RAKHAL-455). `/api/v1/feed/plans`. Same guard chain + subscription gate
 * as `FeedController`. Read = worker-ok; create/update/delete = manager+. A plan never moves stock and
 * never reaches the Feeding page — Apply (RAKHAL-456) does.
 */
@ApiTags('Feed')
@ApiBearerAuth()
@Controller('feed/plans')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
  SubscriptionFeatureGuard,
)
@RequireFeature('feed.formulator')
export class FeedPlanController {
  constructor(
    private readonly plans: FeedPlanService,
    private readonly assignments: FeedPlanAssignmentService,
  ) {}

  @Get()
  @RequirePermission('feed.read')
  list(@CurrentFarmId() farmId: string, @Query() query: ListFeedPlansQueryDto) {
    return this.plans.list(farmId, query);
  }

  @Get(':id')
  @RequirePermission('feed.read')
  get(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.plans.get(farmId, id);
  }

  /** Supply vs requirement, per cow: `GET /feed/plans/:id/fit?cattleIds=a,b,c`. */
  @Get(':id/fit')
  @RequirePermission('feed.read')
  fit(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: FeedPlanFitQueryDto,
  ) {
    return this.plans.fit(farmId, id, query);
  }

  @Post()
  @RequirePermission('feed.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateFeedPlanDto,
  ) {
    return this.plans.create(farmId, userId, dto);
  }

  @Patch(':id')
  @RequirePermission('feed.update')
  update(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeedPlanDto,
  ) {
    return this.plans.update(farmId, userId, id, dto);
  }

  /** Refused (409) while applied, unless `?removeAssignments=true` ("Remove from all & delete"). */
  @Delete(':id')
  @RequirePermission('feed.delete')
  archive(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query() query: ArchiveFeedPlanQueryDto,
  ) {
    return this.plans.archive(farmId, userId, id, query.removeAssignments);
  }

  /** Apply this plan to cows / a group / the herd, replacing the target's active program (RAKHAL-456). */
  @Post(':id/apply')
  @RequirePermission('feed.update')
  apply(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ApplyFeedPlanDto,
  ) {
    return this.assignments.apply(farmId, userId, id, dto);
  }
}
