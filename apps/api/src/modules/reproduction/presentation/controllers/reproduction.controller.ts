import {
  Body,
  Controller,
  Get,
  Headers,
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
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ReproductionService } from '../../application/services/reproduction.service';
import { ReproductionListQueryDto } from '../dto/common.dto';
import { ListPregnanciesQueryDto } from '../dto/list-pregnancies-query.dto';
import { ListReproductionCowsQueryDto } from '../dto/list-reproduction-cows-query.dto';
import { ReproEventsQueryDto } from '../dto/repro-events-query.dto';
import { CreateAbortionEventDto } from '../dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../dto/create-calving-event.dto';
import { CreateDryOffDto } from '../dto/create-dry-off.dto';
import { CreateHeatEventDto } from '../dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../dto/create-pregnancy-diagnosis.dto';
import { CorrectPregnancyDto } from '../dto/correct-pregnancy.dto';
import { CreatePurchasedLactationDto } from '../dto/create-purchased-lactation.dto';
import { ResolveHeatEventDto } from '../dto/resolve-heat-event.dto';
import { ReturnToHeatDto } from '../dto/return-to-heat.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Reproduction (PRD Â§9). `/api/v1/reproduction`. Token tenancy + RBAC. */
@ApiTags('Reproduction')
@ApiBearerAuth()
@Controller('reproduction')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ReproductionController {
  constructor(private readonly reproductionService: ReproductionService) {}

  @Post('heat-events')
  @RequirePermission('reproduction.heat')
  createHeatEvent(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateHeatEventDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reproductionService.createHeatEvent(
      farmId,
      dto,
      idempotencyKey,
    );
  }

  @Get('heat-events')
  @RequirePermission('reproduction.read')
  listHeatEvents(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listHeatEvents(farmId, query);
  }

  /** RAKHAL-298: manually close an open heat (FALSE_ALARM/SKIPPED_CYCLE). */
  @Post('heat-events/:id/resolve')
  @RequirePermission('reproduction.heat')
  resolveHeatEvent(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: ResolveHeatEventDto,
  ) {
    return this.reproductionService.resolveHeatEvent(farmId, id, dto);
  }

  @Post('breeding-events')
  @RequirePermission('reproduction.create')
  createBreedingEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateBreedingEventDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reproductionService.createBreedingEvent(
      farmId,
      userId,
      dto,
      idempotencyKey,
    );
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

  /** RAKHAL-316: farmer-confirmed return to heat before a pregnancy check was due. */
  @Post('breeding-events/:id/return-to-heat')
  @RequirePermission('reproduction.heat')
  returnToHeat(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ReturnToHeatDto,
  ) {
    return this.reproductionService.returnToHeat(farmId, userId, id, dto);
  }

  @Post('pregnancy-diagnoses')
  @RequirePermission('reproduction.create')
  createPregnancyDiagnosis(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreatePregnancyDiagnosisDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reproductionService.createPregnancyDiagnosis(
      farmId,
      userId,
      dto,
      idempotencyKey,
    );
  }

  @Get('pregnancies')
  @RequirePermission('reproduction.read')
  listPregnancies(
    @CurrentFarmId() farmId: string,
    @Query() query: ListPregnanciesQueryDto,
  ) {
    return this.reproductionService.listPregnancies(farmId, query);
  }

  /** RAKHAL-325: explicit "this was a data-entry mistake" correction — never a hard delete. */
  @Post('pregnancies/:id/correct')
  @RequirePermission('reproduction.create')
  correctPregnancy(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CorrectPregnancyDto,
  ) {
    return this.reproductionService.correctPregnancy(farmId, userId, id, dto);
  }

  @Post('calving-events')
  @RequirePermission('reproduction.create')
  createCalvingEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateCalvingEventDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reproductionService.createCalvingEvent(
      farmId,
      userId,
      dto,
      idempotencyKey,
    );
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

  /** RD-038: record a dry-off — ends the active Lactation, opens a DryPeriod, flips Cattle to DRY. */
  @Post('cattle/:id/dry-off')
  @RequirePermission('reproduction.create')
  recordDryOff(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: CreateDryOffDto,
  ) {
    return this.reproductionService.recordDryOff(farmId, id, dto);
  }

  /** RAKHAL-281: start a Lactation for a purchased-lactating cow with no
   * CalvingEvent on record — mirrors the `cattle/:id/dry-off` route shape. */
  @Post('cattle/:id/purchased-lactation')
  @RequirePermission('reproduction.create')
  createPurchasedLactation(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CreatePurchasedLactationDto,
  ) {
    return this.reproductionService.createPurchasedLactation(
      farmId,
      userId,
      id,
      dto,
    );
  }

  @Get('lactations')
  @RequirePermission('reproduction.read')
  listLactations(
    @CurrentFarmId() farmId: string,
    @Query() query: ReproductionListQueryDto,
  ) {
    return this.reproductionService.listLactations(farmId, query);
  }

  /** RAKHAL-051: Reproduction dashboard â€” KPIs + action panels + calving forecast. */
  @Get('dashboard')
  @RequirePermission('reproduction.read')
  dashboard(@CurrentFarmId() farmId: string) {
    return this.reproductionService.dashboard(farmId);
  }

  /** RAKHAL-363: every cow currently in an active reproductive cycle (OPEN /
   * BRED_AWAITING_CONFIRMATION / PREGNANT) — replaces the dashboard's embedded,
   * uncapped, OPEN-only `open_cows[]` list with a proper paginated endpoint. */
  @Get('cows')
  @RequirePermission('reproduction.read')
  listReproductionCows(
    @CurrentFarmId() farmId: string,
    @Query() query: ListReproductionCowsQueryDto,
  ) {
    return this.reproductionService.listReproductionCows(farmId, query);
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
