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
import { ForageService } from '../../application/services/forage.service';
import { CreateForageDto } from '../dto/create-forage.dto';
import { ListForageQueryDto } from '../dto/list-forage-query.dto';
import { UpdateForageDto } from '../dto/update-forage.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Inventory â†’ Forage tab. `/api/v1/inventory/forages`. Token tenancy + RBAC. */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/forages')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ForageController {
  constructor(private readonly forageService: ForageService) {}

  @Post()
  @RequirePermission('inventory.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateForageDto,
  ) {
    return this.forageService.create(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('inventory.read')
  findAll(@CurrentFarmId() farmId: string, @Query() query: ListForageQueryDto) {
    return this.forageService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('inventory.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.forageService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('inventory.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateForageDto,
  ) {
    return this.forageService.update(farmId, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermission('inventory.update')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.forageService.archive(farmId, id);
  }

  @Patch(':id/restore')
  @RequirePermission('inventory.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.forageService.restore(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.forageService.remove(farmId, id);
  }
}
