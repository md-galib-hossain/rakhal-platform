import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SettingsService } from '../../application/services/settings.service';
import { UpdateFarmSettingsDto } from '../dto/update-farm-settings.dto';
import { CreateShedDto } from '../dto/create-shed.dto';
import { UpdateShedDto } from '../dto/update-shed.dto';
import { CreateFeedGroupDto } from '../dto/create-feed-group.dto';
import { UpdateFeedGroupDto } from '../dto/update-feed-group.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Settings (PRD §21 / API §18). `/api/v1/settings`. Token tenancy + RBAC. */
@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Farm workspace ──────────────────────────────────────────────────────────

  @Get('farm')
  @RequirePermission('settings.read')
  getFarm(@CurrentFarmId() farmId: string) {
    return this.settingsService.getFarm(farmId);
  }

  @Patch('farm')
  @RequirePermission('settings.update')
  updateFarm(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: UpdateFarmSettingsDto,
  ) {
    return this.settingsService.updateFarm(farmId, userId, dto);
  }

  // ── Sheds ───────────────────────────────────────────────────────────────────

  @Get('sheds')
  @RequirePermission('settings.read')
  listSheds(@CurrentFarmId() farmId: string) {
    return this.settingsService.listSheds(farmId);
  }

  @Post('sheds')
  @RequirePermission('settings.update')
  createShed(@CurrentFarmId() farmId: string, @Body() dto: CreateShedDto) {
    return this.settingsService.createShed(farmId, dto);
  }

  @Patch('sheds/:id')
  @RequirePermission('settings.update')
  updateShed(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShedDto,
  ) {
    return this.settingsService.updateShed(farmId, id, dto);
  }

  @Delete('sheds/:id')
  @RequirePermission('settings.update')
  deleteShed(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.settingsService.deleteShed(farmId, id);
  }

  // ── Feed Groups ─────────────────────────────────────────────────────────────

  @Get('feed-groups')
  @RequirePermission('settings.read')
  listFeedGroups(@CurrentFarmId() farmId: string) {
    return this.settingsService.listFeedGroups(farmId);
  }

  @Post('feed-groups')
  @RequirePermission('settings.update')
  createFeedGroup(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateFeedGroupDto,
  ) {
    return this.settingsService.createFeedGroup(farmId, dto);
  }

  @Patch('feed-groups/:id')
  @RequirePermission('settings.update')
  updateFeedGroup(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeedGroupDto,
  ) {
    return this.settingsService.updateFeedGroup(farmId, id, dto);
  }

  @Delete('feed-groups/:id')
  @RequirePermission('settings.update')
  deleteFeedGroup(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.settingsService.deleteFeedGroup(farmId, id);
  }
}
