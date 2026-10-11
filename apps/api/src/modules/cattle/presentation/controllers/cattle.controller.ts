import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { env } from 'src/core/config/env';
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
import { BcsService } from '../../application/services/bcs.service';
import { CattleDetailService } from '../../application/services/cattle-detail.service';
import { CattleImportService } from '../../application/services/cattle-import.service';
import { CattleService } from '../../application/services/cattle.service';
import { WeightService } from '../../application/services/weight.service';
import { AncestryQueryDto } from '../dto/ancestry-query.dto';
import { ArchiveCattleDto } from '../dto/archive-cattle.dto';
import { BulkCattleDto } from '../dto/bulk-cattle.dto';
import { CattleFinanceQueryDto } from '../dto/cattle-finance-query.dto';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { DisposeCattleDto } from '../dto/dispose-cattle.dto';
import { ImportConfirmDto, ImportPreviewDto } from '../dto/import-cattle.dto';
import { ListCattleQueryDto } from '../dto/list-cattle-query.dto';
import { RecordBcsDto } from '../dto/record-bcs.dto';
import { RecordWeightDto } from '../dto/record-weight.dto';
import { UpcomingEventsQueryDto } from '../dto/upcoming-events-query.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { UpdateHerdStatusDto } from '../dto/update-cattle-status.dto';
import { WeightHistoryQueryDto } from '../dto/weight-history-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Max CSV upload size for bulk import (PRD §8.4). */
const CSV_MAX_BYTES = 5 * 1024 * 1024;

/** Max profile-photo upload size (RAKHAL-009) — the raw file is compressed server-side. */
const PHOTO_MAX_BYTES = env.MEDIA_MAX_UPLOAD_BYTES;

/** Cattle (PRD §8). `/api/v1/cattle`. Token tenancy + RBAC + subscription baseline. */
@ApiTags('Cattle')
@ApiBearerAuth()
@Controller('cattle')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class CattleController {
  constructor(
    private readonly cattleService: CattleService,
    private readonly bcsService: BcsService,
    private readonly weightService: WeightService,
    private readonly detailService: CattleDetailService,
    private readonly importService: CattleImportService,
  ) {}

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

  @Get('highlights')
  @RequirePermission('cattle.read')
  highlights(@CurrentFarmId() farmId: string) {
    return this.cattleService.highlights(farmId);
  }

  /** RAKHAL-475: one animal's upcoming events (health steps, pregnancy check, calving, dry-off, tasks, withdrawals). */
  @Get(':id/upcoming-events')
  @RequirePermission('cattle.read')
  upcomingEvents(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: UpcomingEventsQueryDto,
  ) {
    return this.cattleService.findUpcomingEvents(farmId, id, query);
  }

  @Post('bulk')
  @RequirePermission('cattle.bulk')
  bulk(
    @CurrentFarmId() farmId: string,
    @Body() dto: BulkCattleDto,
    @CurrentUserId() userId: string,
  ) {
    return this.cattleService.bulk(farmId, dto, userId);
  }

  @Get('import/template')
  @RequirePermission('cattle.create')
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.importService.buildTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="cattle-import-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import/preview')
  @RequirePermission('cattle.create')
  @ThrottleUpload()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: CSV_MAX_BYTES } }),
  )
  importPreview(
    @CurrentFarmId() farmId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportPreviewDto,
  ) {
    return this.importService.preview(farmId, file, dto.mapping);
  }

  @Post('import/confirm')
  @RequirePermission('cattle.create')
  importConfirm(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ImportConfirmDto,
  ) {
    return this.importService.confirm(farmId, userId, dto);
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

  @Get(':id/bcs')
  @RequirePermission('cattle.read')
  bcsHistory(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.bcsService.history(farmId, id);
  }

  @Post(':id/bcs')
  @RequirePermission('cattle.bcs')
  recordBcs(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RecordBcsDto,
  ) {
    return this.bcsService.recordBcs(farmId, userId, id, dto);
  }

  @Get(':id/weight')
  @RequirePermission('cattle.read')
  weightHistory(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.weightService.history(farmId, id);
  }

  @Get(':id/weight/history')
  @RequirePermission('cattle.read')
  weightPeriodHistory(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: WeightHistoryQueryDto,
  ) {
    return this.weightService.periodHistory(farmId, id, query.period);
  }

  @Post(':id/weight')
  @RequirePermission('cattle.update')
  recordWeight(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RecordWeightDto,
  ) {
    return this.weightService.recordWeight(farmId, userId, id, dto);
  }

  // Profile photo (RAKHAL-009, PRD §8.4). Upload → Sharp-processed → private R2;
  // gated by `cattle.update` (the entity permission governs the write).
  @Get(':id/photo')
  @RequirePermission('cattle.read')
  getPhoto(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.getProfilePhoto(farmId, id);
  }

  @Post(':id/photo')
  @RequirePermission('cattle.update')
  @ThrottleUpload()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: PHOTO_MAX_BYTES } }),
  )
  setPhoto(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.cattleService.setProfilePhoto(farmId, userId, id, file);
  }

  @Delete(':id/photo')
  @RequirePermission('cattle.update')
  removePhoto(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.cattleService.removeProfilePhoto(farmId, userId, id);
  }

  // Detail-page tabs (PRD §8.5). Reproduction (Tab 2) + Health (Tab 3) are
  // served by the reproduction/health modules' `*-summary` endpoints.
  @Get(':id/overview')
  @RequirePermission('cattle.read')
  overview(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.detailService.overview(farmId, id);
  }

  @Get(':id/pedigree')
  @RequirePermission('cattle.read')
  pedigree(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.detailService.pedigree(farmId, id);
  }

  @Get(':id/finance')
  @RequirePermission('finance.read')
  finance(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: CattleFinanceQueryDto,
  ) {
    return this.detailService.cattleFinance(farmId, id, query.period);
  }

  @Get(':id')
  @RequirePermission('cattle.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.findOne(farmId, id);
  }

  @Patch(':id/status')
  @RequirePermission('cattle.update')
  updateStatus(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHerdStatusDto,
  ) {
    return this.cattleService.updateStatus(farmId, id, dto);
  }

  @Patch(':id')
  @RequirePermission('cattle.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCattleDto,
    @CurrentUserId() userId: string,
  ) {
    return this.cattleService.update(farmId, id, dto, userId);
  }

  @Patch(':id/archive')
  @RequirePermission('cattle.archive')
  archive(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @CurrentUserId() userId: string,
  ) {
    return this.cattleService.archive(farmId, id, userId);
  }

  @Patch(':id/restore')
  @RequirePermission('cattle.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.cattleService.restore(farmId, id);
  }

  @Post(':id/dispose')
  @RequirePermission('cattle.dispose')
  dispose(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: DisposeCattleDto,
  ) {
    return this.cattleService.recordDisposition(farmId, userId, id, {
      type: dto.type,
      date: new Date(dto.date),
      reason: dto.reason,
      price: dto.price,
    });
  }

  @Delete(':id')
  @RequirePermission('cattle.archive')
  remove(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: ArchiveCattleDto,
    @CurrentUserId() userId: string,
  ) {
    return this.cattleService.remove(farmId, id, dto, userId);
  }
}
