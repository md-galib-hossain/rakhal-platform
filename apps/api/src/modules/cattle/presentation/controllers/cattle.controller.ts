import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BcsService } from '../../application/services/bcs.service';
import { CattleImportService } from '../../application/services/cattle-import.service';
import { CattleService } from '../../application/services/cattle.service';
import { AncestryQueryDto } from '../dto/ancestry-query.dto';
import { ArchiveCattleDto } from '../dto/archive-cattle.dto';
import { BulkCattleDto } from '../dto/bulk-cattle.dto';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { ImportConfirmDto, ImportPreviewDto } from '../dto/import-cattle.dto';
import { ListCattleQueryDto } from '../dto/list-cattle-query.dto';
import { RecordBcsDto } from '../dto/record-bcs.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { UpdateCattleStatusDto } from '../dto/update-cattle-status.dto';

/** Max CSV upload size for bulk import (PRD §8.4). */
const CSV_MAX_BYTES = 5 * 1024 * 1024;

/** Cattle (PRD §8). `/api/v1/cattle`. Token tenancy + RBAC. */
@Controller('cattle')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class CattleController {
  constructor(
    private readonly cattleService: CattleService,
    private readonly bcsService: BcsService,
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

  @Post('bulk')
  @RequirePermission('cattle.bulk')
  bulk(@CurrentFarmId() farmId: string, @Body() dto: BulkCattleDto) {
    return this.cattleService.bulk(farmId, dto);
  }

  @Post('import/preview')
  @RequirePermission('cattle.create')
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
    @Body() dto: UpdateCattleStatusDto,
  ) {
    return this.cattleService.updateStatus(farmId, id, dto);
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
  remove(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: ArchiveCattleDto,
  ) {
    return this.cattleService.remove(farmId, id, dto);
  }
}
