import {
  Body,
  Controller,
  Get,
  Param,
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
import { MilkService } from '../../application/services/milk.service';
import {
  MilkAnomalyQueryDto,
  MilkLogQueryDto,
  MilkOverviewQueryDto,
} from '../dto/milk-query.dto';
import { ReviewAnomalyDto } from '../dto/review-anomaly.dto';
import { SaveMilkLogDto } from '../dto/save-milk-log.dto';
import { SubmitMilkDto } from '../dto/submit-milk.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Milk Module (PRD §10). `/api/v1/milk`. Token tenancy + RBAC. */
@ApiTags('Milk')
@ApiBearerAuth()
@Controller('milk')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class MilkController {
  constructor(private readonly milkService: MilkService) {}

  @Get('overview')
  @RequirePermission('milk.read')
  overview(
    @CurrentFarmId() farmId: string,
    @Query() query: MilkOverviewQueryDto,
  ) {
    return this.milkService.overview(farmId, query.date);
  }

  @Get('log')
  @RequirePermission('milk.read')
  logTable(@CurrentFarmId() farmId: string, @Query() query: MilkLogQueryDto) {
    return this.milkService.logTable(farmId, query);
  }

  @Post('log')
  @RequirePermission('milk.log')
  saveLog(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SaveMilkLogDto,
  ) {
    return this.milkService.saveLog(farmId, userId, dto);
  }

  @Post('submit')
  @RequirePermission('milk.log')
  submit(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SubmitMilkDto,
  ) {
    return this.milkService.submit(farmId, userId, dto);
  }

  @Get('anomalies')
  @RequirePermission('milk.read')
  anomalies(
    @CurrentFarmId() farmId: string,
    @Query() query: MilkAnomalyQueryDto,
  ) {
    return this.milkService.anomalies(farmId, query.date);
  }

  @Post('anomalies/:id/review')
  @RequirePermission('milk.update')
  reviewAnomaly(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: ReviewAnomalyDto,
  ) {
    return this.milkService.reviewAnomaly(farmId, id, dto);
  }
}
