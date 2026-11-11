import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { FeedPlanAssignmentService } from '../../application/services/feed-plan-assignment.service';
import { ListPlanAssignmentsQueryDto } from '../dto/feed-plan.dto';
import {
  ApiEnvelopeResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-envelope';
import {
  FeedPlanAssignmentListItemDto,
  FeedPlanAssignmentNamedDto,
} from 'src/modules/feed/presentation/dto/feed-response.dto';

/**
 * Feed program assignments (MILESTONE 27, RAKHAL-456). `/api/v1/feed/plan-assignments`. Apply lives on
 * the plan (`POST /feed/plans/:id/apply`); this controller lists and removes. Read = worker-ok,
 * remove = `feed.update` (manager+).
 */
@ApiTags('Feed')
@ApiBearerAuth()
@Controller('feed/plan-assignments')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
  SubscriptionFeatureGuard,
)
@RequireFeature('feed.formulator')
export class FeedPlanAssignmentController {
  constructor(private readonly assignments: FeedPlanAssignmentService) {}

  /** Active and ended, newest first: `?cattleId=` / `?animalGroupId=` / `?planId=` / `?status=`. */
  @Get()
  @RequirePermission('feed.read')
  @ApiPaginatedResponse(FeedPlanAssignmentListItemDto)
  list(
    @CurrentFarmId() farmId: string,
    @Query() query: ListPlanAssignmentsQueryDto,
  ) {
    return this.assignments.list(farmId, query);
  }

  /** Ends the program on that target (the row is kept, `removedAt` set). */
  @Post(':id/remove')
  @RequirePermission('feed.update')
  @ApiEnvelopeResponse(FeedPlanAssignmentNamedDto, { status: 201 })
  remove(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.assignments.remove(farmId, userId, id);
  }
}
