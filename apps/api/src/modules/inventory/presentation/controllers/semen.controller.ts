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
import { SemenService } from '../../application/services/semen.service';
import { CreateSemenTankDto, UpdateSemenTankDto } from '../dto/semen-tank.dto';
import {
  CreateSemenBatchDto,
  ListSemenBatchQueryDto,
  UpdateSemenBatchDto,
} from '../dto/semen-batch.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Inventory â†’ Semen tab. Tanks under `/api/v1/inventory/semen/tanks`, straw
 * batches under `/api/v1/inventory/semen/batches`. Token-based tenancy.
 */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/semen')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class SemenController {
  constructor(private readonly semenService: SemenService) {}

  // Tanks
  @Get('tanks')
  @RequirePermission('inventory.read')
  listTanks(@CurrentFarmId() farmId: string) {
    return this.semenService.listTanks(farmId);
  }

  @Post('tanks')
  @RequirePermission('inventory.create')
  createTank(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateSemenTankDto,
  ) {
    return this.semenService.createTank(farmId, userId, dto);
  }

  @Patch('tanks/:id')
  @RequirePermission('inventory.update')
  updateTank(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSemenTankDto,
  ) {
    return this.semenService.updateTank(farmId, id, dto, userId);
  }

  @Delete('tanks/:id')
  @RequirePermission('inventory.delete')
  archiveTank(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.semenService.archiveTank(farmId, id, userId);
  }

  // Batches
  @Get('batches')
  @RequirePermission('inventory.read')
  listBatches(
    @CurrentFarmId() farmId: string,
    @Query() query: ListSemenBatchQueryDto,
  ) {
    return this.semenService.listBatches(farmId, query);
  }

  @Post('batches')
  @RequirePermission('inventory.create')
  createBatch(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateSemenBatchDto,
  ) {
    return this.semenService.createBatch(farmId, userId, dto);
  }

  @Patch('batches/:id')
  @RequirePermission('inventory.update')
  updateBatch(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSemenBatchDto,
  ) {
    return this.semenService.updateBatch(farmId, id, dto, userId);
  }

  @Delete('batches/:id')
  @RequirePermission('inventory.delete')
  archiveBatch(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.semenService.archiveBatch(farmId, id, userId);
  }
}
