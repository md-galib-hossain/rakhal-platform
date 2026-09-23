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
import { MilkTankService } from '../../application/services/milk-tank.service';
import {
  AdjustMilkTankVolumeDto,
  CreateMilkTankDto,
  ListMilkTankAuditQueryDto,
  ListMilkTankQueryDto,
  UpdateMilkTankDto,
} from '../dto/milk-tank.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Inventory â†’ Milk tab. `/api/v1/inventory/milk-tanks`. Token-based tenancy. */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/milk-tanks')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class MilkTankController {
  constructor(private readonly milkTankService: MilkTankService) {}

  // Static route declared before ':id' so it is not captured as a param.
  @Get('audit-log')
  @RequirePermission('inventory.read')
  auditLog(
    @CurrentFarmId() farmId: string,
    @Query() query: ListMilkTankAuditQueryDto,
  ) {
    return this.milkTankService.auditLog(farmId, query);
  }

  @Get()
  @RequirePermission('inventory.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListMilkTankQueryDto,
  ) {
    return this.milkTankService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('inventory.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.milkTankService.findOne(farmId, id);
  }

  @Post()
  @RequirePermission('inventory.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateMilkTankDto,
  ) {
    return this.milkTankService.create(farmId, userId, dto);
  }

  @Patch(':id')
  @RequirePermission('inventory.update')
  update(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMilkTankDto,
  ) {
    return this.milkTankService.update(farmId, id, dto, userId);
  }

  @Post(':id/set-primary')
  @RequirePermission('inventory.update')
  setPrimary(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.milkTankService.setPrimary(farmId, id, userId);
  }

  @Post(':id/adjust-volume')
  @RequirePermission('inventory.update')
  adjustVolume(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: AdjustMilkTankVolumeDto,
  ) {
    return this.milkTankService.adjustVolumeManual(farmId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  archive(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.milkTankService.archive(farmId, id, userId);
  }
}
