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
import { CattleService } from '../../application/services/cattle.service';
import { AncestryQueryDto } from '../dto/ancestry-query.dto';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { ListCattleQueryDto } from '../dto/list-cattle-query.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';

/** Cattle (PRD §8). `/api/v1/cattle`. Token tenancy + RBAC. */
@Controller('cattle')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class CattleController {
  constructor(private readonly cattleService: CattleService) {}

  @Post()
  @RequirePermission('cattle.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCattleDto,
  ) {
    return this.cattleService.create(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('cattle.read')
  findAll(@CurrentFarmId() farmId: string, @Query() query: ListCattleQueryDto) {
    return this.cattleService.findAll(farmId, query);
  }

  @Get(':id/profile')
  @RequirePermission('cattle.read')
  profile(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.profile(farmId, id);
  }

  @Get(':id/ancestry')
  @RequirePermission('cattle.read')
  ancestry(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: AncestryQueryDto,
  ): Promise<unknown> {
    return this.cattleService.ancestry(farmId, id, query);
  }

  @Get(':id/children')
  @RequirePermission('cattle.read')
  children(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.children(farmId, id);
  }

  @Get(':id/siblings')
  @RequirePermission('cattle.read')
  siblings(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.siblings(farmId, id);
  }

  @Get(':id')
  @RequirePermission('cattle.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('cattle.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCattleDto,
  ) {
    return this.cattleService.update(farmId, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermission('cattle.archive')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.archive(farmId, id);
  }

  @Patch(':id/restore')
  @RequirePermission('cattle.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.restore(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('cattle.archive')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.remove(farmId, id);
  }
}
