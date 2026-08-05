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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { AnimalHoldService } from '../../application/services/animal-hold.service';
import { CreateAnimalHoldDto } from '../dto/create-animal-hold.dto';
import { ListAnimalHoldQueryDto } from '../dto/list-animal-hold-query.dto';
import { ReleaseAnimalHoldDto } from '../dto/release-animal-hold.dto';

/**
 * Generic per-animal hold mechanism (RAKHAL-280). `/api/v1/cattle/:cattleId/holds`.
 * Not yet consumed by reproduction/milk — those wire in on RAKHAL-272/278.
 */
@ApiTags('Cattle')
@ApiBearerAuth()
@Controller('cattle/:cattleId/holds')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class AnimalHoldController {
  constructor(private readonly animalHoldService: AnimalHoldService) {}

  @Get()
  @RequirePermission('cattle.hold')
  list(
    @CurrentFarmId() farmId: string,
    @Param('cattleId') cattleId: string,
    @Query() query: ListAnimalHoldQueryDto,
  ) {
    return this.animalHoldService.list(farmId, cattleId, query);
  }

  @Post()
  @RequirePermission('cattle.hold')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('cattleId') cattleId: string,
    @Body() dto: CreateAnimalHoldDto,
  ) {
    return this.animalHoldService.createHold(farmId, userId, cattleId, dto);
  }

  @Patch(':holdId/release')
  @RequirePermission('cattle.hold')
  release(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('cattleId') cattleId: string,
    @Param('holdId') holdId: string,
    @Body() dto: ReleaseAnimalHoldDto,
  ) {
    return this.animalHoldService.releaseHold(
      farmId,
      cattleId,
      holdId,
      userId,
      dto,
    );
  }
}
