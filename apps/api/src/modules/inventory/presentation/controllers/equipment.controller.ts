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
import { EquipmentService } from '../../application/services/equipment.service';
import { BulkDeleteEquipmentDto } from '../dto/bulk-delete-equipment.dto';
import { CreateEquipmentDto } from '../dto/create-equipment.dto';
import { ListEquipmentQueryDto } from '../dto/list-equipment-query.dto';
import { UpdateEquipmentDto } from '../dto/update-equipment.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-envelope';
import {
  BulkDeleteResponseDto,
  EquipmentResponseDto,
} from '../dto/inventory-response.dto';

/** Inventory â†’ Others/Equipment tab. `/api/v1/inventory/equipment`. Token tenancy + RBAC. */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/equipment')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  @RequirePermission('inventory.create')
  @ApiEnvelopeResponse(EquipmentResponseDto, { status: 201 })
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateEquipmentDto,
  ) {
    return this.equipmentService.create(farmId, userId, dto);
  }

  /** Multi-select delete (bulk-action dock, 2026-07-21) — registered before the `:id` routes. */
  @Post('bulk-delete')
  @RequirePermission('inventory.delete')
  @ApiEnvelopeResponse(BulkDeleteResponseDto, { status: 201 })
  bulkDelete(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: BulkDeleteEquipmentDto,
  ) {
    return this.equipmentService.removeMany(farmId, dto.ids, userId);
  }

  @Get()
  @RequirePermission('inventory.read')
  @ApiPaginatedResponse(EquipmentResponseDto)
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListEquipmentQueryDto,
  ) {
    return this.equipmentService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('inventory.read')
  @ApiEnvelopeResponse(EquipmentResponseDto)
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.equipmentService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('inventory.update')
  @ApiEnvelopeResponse(EquipmentResponseDto)
  update(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipmentService.update(farmId, id, dto, userId);
  }

  @Patch(':id/archive')
  @RequirePermission('inventory.update')
  @ApiEnvelopeResponse(EquipmentResponseDto)
  archive(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.equipmentService.archive(farmId, id, userId);
  }

  @Patch(':id/restore')
  @RequirePermission('inventory.update')
  @ApiEnvelopeResponse(EquipmentResponseDto)
  restore(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.equipmentService.restore(farmId, id, userId);
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  @ApiEnvelopeResponse(EquipmentResponseDto)
  remove(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.equipmentService.remove(farmId, id, userId);
  }
}
