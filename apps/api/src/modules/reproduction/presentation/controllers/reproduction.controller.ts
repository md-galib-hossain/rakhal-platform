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
import { ReproductionService } from '../../application/services/reproduction.service';
import { ReproductionListQueryDto } from '../dto/common.dto';
import { ReproEventsQueryDto } from '../dto/repro-events-query.dto';
import { CreateAbortionEventDto } from '../dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../dto/create-calving-event.dto';
import { CreateHeatEventDto } from '../dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../dto/create-pregnancy-diagnosis.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Reproduction (PRD §9). `/api/v1/reproduction`. Token tenancy + RBAC. */
@ApiTags('Reproduction')
@ApiBearerAuth()
@Controller('reproduction')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class ReproductionController {
  constructor(private readonly reproductionService: ReproductionService) {}

  @Post('heat-events')
  @RequirePermission('reproduction.heat')
  createHeatEvent(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateHeatEventDto,
  ) {
    return this.reproductionService.createHeatEvent(farmId, dto);
  }

  @Get('heat-events')
  @RequirePermission('reproduction.read')
  listHeatEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listHeatEvents(farmId, query);
  }

  @Post('breeding-events')
  @RequirePermission('reproduction.create')
  createBreedingEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateBreedingEventDto,
  ) {
    return this.reproductionService.createBreedingEvent(farmId, userId, dto);
  }

  @Get('breeding-events')
  @RequirePermission('reproduction.read')
  listBreedingEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listBreedingEvents(farmId, query);
  }

  @Get('breeding-events/:id')
  @RequirePermission('reproduction.read')
  getBreedingEvent(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.reproductionService.getBreedingEvent(farmId, id);
  }

  @Post('pregnancy-diagnoses')
  @RequirePermission('reproduction.create')
  createPregnancyDiagnosis(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreatePregnancyDiagnosisDto,
  ) {
    return this.reproductionService.createPregnancyDiagnosis(
      farmId,
      userId,
      dto,
    );
  }

  @Get('pregnancies')
  @RequirePermission('reproduction.read')
  listPregnancies(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listPregnancies(farmId, query);
  }

  @Post('calving-events')
  @RequirePermission('reproduction.create')
  createCalvingEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCalvingEventDto,
  ) {
    return this.reproductionService.createCalvingEvent(farmId, userId, dto);
  }

  @Get('calving-events')
  @RequirePermission('reproduction.read')
  listCalvingEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listCalvingEvents(farmId, query);
  }

  @Post('abortion-events')
  @RequirePermission('reproduction.create')
  createAbortionEvent(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateAbortionEventDto,
  ) {
    return this.reproductionService.createAbortionEvent(farmId, dto);
  }

  @Get('abortion-events')
  @RequirePermission('reproduction.read')
  listAbortionEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listAbortionEvents(farmId, query);
  }

  @Get('lactations')
  @RequirePermission('reproduction.read')
  listLactations(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listLactations(farmId, query);
  }

  /** RAKHAL-051: Reproduction dashboard — KPIs + action panels + calving forecast. */
  @Get('dashboard')
  @RequirePermission('reproduction.read')
  dashboard(@CurrentFarmId() farmId: string) {
    return this.reproductionService.dashboard(farmId);
  }

  /** RAKHAL-051: Unified reproduction events feed with optional filters. */
  @Get('events')
  @RequirePermission('reproduction.read')
  events(@CurrentFarmId() farmId: string, @Query() query: ReproEventsQueryDto) {
    return this.reproductionService.events(farmId, {
      cattleId: query.cattleId,
      eventType: query.eventType,
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit: query.limit,
    });
  }
}
