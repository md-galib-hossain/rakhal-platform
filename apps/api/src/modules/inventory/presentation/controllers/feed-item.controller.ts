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
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { FeedItemService } from '../../application/services/feed-item.service';
import { BulkDeleteFeedItemDto } from '../dto/bulk-delete-feed-item.dto';
import { CreateFeedItemDto } from '../dto/create-feed-item.dto';
import { CreateFeedItemBatchDto } from '../dto/create-feed-item-batch.dto';
import { FeedBatchCodeQueryDto } from '../dto/feed-batch-code-query.dto';
import { UpdateFeedBatchNutritionDto } from '../dto/update-feed-batch-nutrition.dto';
import { ListFeedItemQueryDto } from '../dto/list-feed-item-query.dto';
import { UpdateFeedItemDto } from '../dto/update-feed-item.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Inventory → Feed tab, "Purchased" view. `/api/v1/inventory/feed-items`. Token tenancy + RBAC. */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/feed-items')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class FeedItemController {
  constructor(private readonly feedItemService: FeedItemService) {}

  @Post()
  @RequirePermission('inventory.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateFeedItemDto,
  ) {
    return this.feedItemService.create(farmId, userId, dto);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — registered before the `:id` routes. */
  @Post('bulk-delete')
  @RequirePermission('inventory.delete')
  bulkDelete(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: BulkDeleteFeedItemDto,
  ) {
    return this.feedItemService.removeMany(farmId, dto.ids, userId);
  }

  /** Recall lookup by lot code (RAKHAL-444) — registered before the `:id` routes. */
  @Get('by-batch-code')
  @RequirePermission('inventory.read')
  byBatchCode(
    @CurrentFarmId() farmId: string,
    @Query() query: FeedBatchCodeQueryDto,
  ) {
    return this.feedItemService.findByBatchCode(farmId, query.code);
  }

  @Get()
  @RequirePermission('inventory.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListFeedItemQueryDto,
  ) {
    return this.feedItemService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('inventory.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.feedItemService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('inventory.update')
  update(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeedItemDto,
  ) {
    return this.feedItemService.update(farmId, userId, id, dto);
  }

  /** Restock: add a new lot (own cost/date/code/nutrition) to an existing product. */
  @Post(':id/batches')
  @RequirePermission('inventory.create')
  createBatch(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CreateFeedItemBatchDto,
  ) {
    return this.feedItemService.createBatch(farmId, userId, id, dto);
  }

  /** Edit a lot's nutrition — appends a new immutable profile (manager+). */
  @Patch(':id/batches/:batchId/nutrition')
  @RequirePermission('inventory.update')
  reviseNutrition(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateFeedBatchNutritionDto,
  ) {
    return this.feedItemService.reviseBatchNutrition(
      farmId,
      userId,
      id,
      batchId,
      dto,
    );
  }

  /** One-click revert to the previous nutrition profile of this lot. */
  @Post(':id/batches/:batchId/nutrition/revert')
  @RequirePermission('inventory.update')
  revertNutrition(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('batchId') batchId: string,
  ) {
    return this.feedItemService.revertBatchNutrition(
      farmId,
      userId,
      id,
      batchId,
    );
  }

  /** Re-copy today's catalogue values into a new profile for this lot ("Re-sync"). */
  @Post(':id/batches/:batchId/nutrition/resync')
  @RequirePermission('inventory.update')
  resyncNutrition(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('batchId') batchId: string,
  ) {
    return this.feedItemService.resyncBatchNutrition(
      farmId,
      userId,
      id,
      batchId,
    );
  }

  @Patch(':id/archive')
  @RequirePermission('inventory.update')
  archive(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.feedItemService.archive(farmId, id, userId);
  }

  @Patch(':id/restore')
  @RequirePermission('inventory.update')
  restore(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.feedItemService.restore(farmId, id, userId);
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  remove(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.feedItemService.remove(farmId, id, userId);
  }
}
