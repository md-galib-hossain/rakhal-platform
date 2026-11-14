import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { FarmService } from '../../application/services/farm.service';
import { CreateFarmDto } from '../dto/create-farm.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Farm bootstrap endpoints. `/api/v1/farms`.
 *
 * Only authenticated (not yet farm-scoped) — creating/listing farms happens
 * before a farm context exists, so these use JwtAuthGuard + SessionGuard only.
 */
@ApiTags('Farm')
@ApiBearerAuth()
@Controller('farms')
@UseGuards(JwtAuthGuard, SessionGuard)
export class FarmController {
  constructor(private readonly farmService: FarmService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateFarmDto) {
    return this.farmService.create(userId, dto);
  }

  @Get()
  listMine(@CurrentUserId() userId: string) {
    return this.farmService.listMine(userId);
  }

  /**
   * Soft-delete the caller's currently active farm. Needs `FarmContextGuard` (stacked onto the
   * class-level bootstrap guards, Nest accumulates guards controller→route) since deleting "my
   * current farm" reads `farmId` from the token, not a body/param (no `farmId` in bodies).
   */
  @Delete()
  @UseGuards(FarmContextGuard)
  @HttpCode(200)
  softDelete(@CurrentFarmId() farmId: string, @CurrentUserId() userId: string) {
    return this.farmService.softDelete(farmId, userId);
  }
}
