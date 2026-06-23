import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmService } from '../../application/services/farm.service';
import { CreateFarmDto } from '../dto/create-farm.dto';

/**
 * Farm bootstrap endpoints. `/api/v1/farms`.
 *
 * Only authenticated (not yet farm-scoped) — creating/listing farms happens
 * before a farm context exists, so these use JwtAuthGuard + SessionGuard only.
 */
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
}
