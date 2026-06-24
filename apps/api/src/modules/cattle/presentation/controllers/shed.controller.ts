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
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ShedService } from '../../application/services/shed.service';
import { CreateShedDto } from '../dto/create-shed.dto';
import { ListShedQueryDto } from '../dto/list-shed-query.dto';
import { UpdateShedDto } from '../dto/update-shed.dto';

/** Sheds (PRD §21.3). `/api/v1/sheds`. Token tenancy + RBAC (cattle.*). */
@Controller('sheds')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class ShedController {
  constructor(private readonly shedService: ShedService) {}

  @Post()
  @RequirePermission('cattle.create')
  create(@CurrentFarmId() farmId: string, @Body() dto: CreateShedDto) {
    return this.shedService.create(farmId, dto);
  }

  @Get()
  @RequirePermission('cattle.read')
  findAll(@CurrentFarmId() farmId: string, @Query() query: ListShedQueryDto) {
    return this.shedService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('cattle.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.shedService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('cattle.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShedDto,
  ) {
    return this.shedService.update(farmId, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermission('cattle.update')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.shedService.archive(farmId, id);
  }

  @Patch(':id/restore')
  @RequirePermission('cattle.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.shedService.restore(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('cattle.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.shedService.remove(farmId, id);
  }
}
