import {
  Body,
  Controller,
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
import { UnitService } from '../../application/services/unit.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { ListUnitQueryDto } from '../dto/list-unit-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Unit catalog (RAKHAL-326) — `/api/v1/inventory/units`. Token tenancy + RBAC, reuses the
 * same `inventory.read`/`inventory.create` permissions Medicine/Equipment/FeedItem already
 * gate on (no new permission needed). */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/units')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  @RequirePermission('inventory.read')
  findAll(@CurrentFarmId() farmId: string, @Query() query: ListUnitQueryDto) {
    return this.unitService.findAll(farmId, query);
  }

  @Post()
  @RequirePermission('inventory.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.unitService.create(farmId, dto, userId);
  }

  @Patch(':id/archive')
  @RequirePermission('inventory.delete')
  archive(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.unitService.archive(farmId, id, userId);
  }
}
