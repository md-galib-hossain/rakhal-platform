import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  CurrentFarmId,
  CurrentUserId,
  ThrottleUpload,
} from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { MilkAvailabilityService } from '../../application/services/milk-availability.service';
import { MilkExportService } from '../../application/services/milk-export.service';
import { MilkImportService } from '../../application/services/milk-import.service';
import { MilkQualityService } from '../../application/services/milk-quality.service';
import { MilkService } from '../../application/services/milk.service';
import { CreateMilkQualityTestDto } from '../dto/create-milk-quality-test.dto';
import { ExportMilkLogDto } from '../dto/export-milk-log.dto';
import { ImportMilkConfirmDto } from '../dto/import-milk.dto';
import { MilkLogCalendarQueryDto } from '../dto/milk-log-calendar-query.dto';
import {
  LatestMilkQualityTestQueryDto,
  ListMilkQualityTestQueryDto,
} from '../dto/list-milk-quality-test-query.dto';
import {
  MilkAnomalyQueryDto,
  MilkAvailabilityQueryDto,
  MilkLogQueryDto,
  MilkOverviewQueryDto,
} from '../dto/milk-query.dto';
import { ReviewAnomalyDto } from '../dto/review-anomaly.dto';
import { SaveMilkLogDto } from '../dto/save-milk-log.dto';
import { SubmitMilkDto } from '../dto/submit-milk.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiEnvelopeResponse,
  ApiPaginatedResponse,
} from 'src/common/swagger/api-envelope';
import { MilkAvailabilityResponseDto } from '../dto/milk-availability-response.dto';
import { MilkQualityTestResponseDto } from '../dto/milk-quality-test-response.dto';
import {
  MilkAnomalyItemDto,
  MilkEligibilityResponseDto,
  MilkImportConfirmResponseDto,
  MilkImportPreviewResponseDto,
  MilkLogCalendarResponseDto,
  MilkLogEntryRowDto,
  MilkLogTableResponseDto,
  MilkOverviewResponseDto,
  MilkSaveLogResponseDto,
  MilkSubmitResponseDto,
} from '../dto/milk-log-response.dto';

/** Max Excel upload size for milk log import. */
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Milk Module (PRD §10). `/api/v1/milk`. Token tenancy + RBAC + subscription baseline. */
@ApiTags('Milk')
@ApiBearerAuth()
@Controller('milk')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class MilkController {
  constructor(
    private readonly milkService: MilkService,
    private readonly importService: MilkImportService,
    private readonly exportService: MilkExportService,
    private readonly milkQualityService: MilkQualityService,
    private readonly milkAvailabilityService: MilkAvailabilityService,
  ) {}

  /** RAKHAL-343 — available-to-sell volume per SELLABLE tank. Unlocked
   * snapshot for display; `SellMilkUseCase` takes its own row lock via
   * `MilkAvailabilityService.lockAndValidate` at actual sale time. */
  @Get('availability')
  @RequirePermission('milk.read')
  @ApiEnvelopeResponse(MilkAvailabilityResponseDto)
  availability(
    @CurrentFarmId() farmId: string,
    @Query() query: MilkAvailabilityQueryDto,
  ) {
    return this.milkAvailabilityService.getAvailability(farmId, query.tankId);
  }

  @Get('overview')
  @RequirePermission('milk.read')
  @ApiEnvelopeResponse(MilkOverviewResponseDto)
  overview(
    @CurrentFarmId() farmId: string,
    @Query() query: MilkOverviewQueryDto,
  ) {
    return this.milkService.overview(farmId, query.date, query.range);
  }

  @Get('log')
  @RequirePermission('milk.read')
  @ApiEnvelopeResponse(MilkLogTableResponseDto)
  logTable(@CurrentFarmId() farmId: string, @Query() query: MilkLogQueryDto) {
    return this.milkService.logTable(farmId, query);
  }

  /** RAKHAL-434: per-day entry status for the calendar picker. */
  @Get('log/calendar')
  @RequirePermission('milk.read')
  @ApiEnvelopeResponse(MilkLogCalendarResponseDto)
  logCalendar(
    @CurrentFarmId() farmId: string,
    @Query() query: MilkLogCalendarQueryDto,
  ) {
    return this.milkService.logCalendar(farmId, query.month);
  }

  @Post('log')
  @RequirePermission('milk.log')
  @ApiEnvelopeResponse(MilkSaveLogResponseDto, { status: 201 })
  saveLog(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SaveMilkLogDto,
  ) {
    return this.milkService.saveLog(farmId, userId, dto);
  }

  @Post('submit')
  @RequirePermission('milk.log')
  @ApiEnvelopeResponse(MilkSubmitResponseDto, { status: 201 })
  submit(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: SubmitMilkDto,
  ) {
    return this.milkService.submit(farmId, userId, dto);
  }

  @Get('cattle/:id/eligibility')
  @RequirePermission('milk.read')
  @ApiEnvelopeResponse(MilkEligibilityResponseDto)
  eligibility(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.milkService.getMilkEligibility(farmId, id);
  }

  @Get('anomalies')
  @RequirePermission('milk.read')
  @ApiPaginatedResponse(MilkAnomalyItemDto)
  anomalies(
    @CurrentFarmId() farmId: string,
    @Query() query: MilkAnomalyQueryDto,
  ) {
    return this.milkService.anomalies(farmId, query);
  }

  @Post('anomalies/:id/review')
  @RequirePermission('milk.update')
  @ApiEnvelopeResponse(MilkLogEntryRowDto, { status: 201 })
  reviewAnomaly(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: ReviewAnomalyDto,
  ) {
    return this.milkService.reviewAnomaly(farmId, id, dto);
  }

  @Post('import/preview')
  @RequirePermission('milk.log')
  @ThrottleUpload()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES } }),
  )
  @ApiEnvelopeResponse(MilkImportPreviewResponseDto, { status: 201 })
  importPreview(
    @CurrentFarmId() farmId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.importService.preview(farmId, file);
  }

  @Post('import/confirm')
  @RequirePermission('milk.log')
  @ApiEnvelopeResponse(MilkImportConfirmResponseDto, { status: 201 })
  importConfirm(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ImportMilkConfirmDto,
  ) {
    return this.importService.confirm(farmId, userId, dto);
  }

  @Post('export')
  @RequirePermission('milk.read')
  async exportLog(
    @CurrentFarmId() farmId: string,
    @Body() dto: ExportMilkLogDto,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.exportService.exportLog(
      farmId,
      dto,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Post('quality-tests')
  @RequirePermission('milk.quality.create')
  @ApiEnvelopeResponse(MilkQualityTestResponseDto, { status: 201 })
  createQualityTest(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateMilkQualityTestDto,
  ) {
    return this.milkQualityService.create(farmId, userId, dto);
  }

  @Get('quality-tests/latest')
  @RequirePermission('milk.quality.read')
  @ApiEnvelopeResponse(MilkQualityTestResponseDto, {
    description:
      "The cow's most recent test. When the cow has no test yet the body is empty (HTTP 200, no JSON): the response interceptor does not wrap null.",
  })
  latestQualityTest(
    @CurrentFarmId() farmId: string,
    @Query() query: LatestMilkQualityTestQueryDto,
  ) {
    return this.milkQualityService.latestForCattle(farmId, query.cattleId);
  }

  @Get('quality-tests')
  @RequirePermission('milk.quality.read')
  @ApiPaginatedResponse(MilkQualityTestResponseDto)
  listQualityTests(
    @CurrentFarmId() farmId: string,
    @Query() query: ListMilkQualityTestQueryDto,
  ) {
    return this.milkQualityService.list(farmId, query);
  }
}
