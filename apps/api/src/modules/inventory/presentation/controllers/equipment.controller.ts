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
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { EquipmentService } from '../../application/services/equipment.service';
import { CreateEquipmentDto } from '../dto/create-equipment.dto';
import { ListEquipmentQueryDto } from '../dto/list-equipment-query.dto';
import { UpdateEquipmentDto } from '../dto/update-equipment.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Inventory → Others/Equipment tab. `/api/v1/inventory/equipment`. Token tenancy + RBAC. */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/equipment')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Post()
  @RequirePermission('inventory.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateEquipmentDto,
  ) {
    return this.equipmentService.create(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('inventory.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListEquipmentQueryDto,
  ) {
    return this.equipmentService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('inventory.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.equipmentService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('inventory.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipmentService.update(farmId, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermission('inventory.update')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.equipmentService.archive(farmId, id);
  }

  @Patch(':id/restore')
  @RequirePermission('inventory.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.equipmentService.restore(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.equipmentService.remove(farmId, id);
  }
}
