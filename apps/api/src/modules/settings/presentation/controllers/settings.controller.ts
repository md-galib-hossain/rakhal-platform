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
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SettingsService } from '../../application/services/settings.service';
import { UpdateFarmSettingsDto } from '../dto/update-farm-settings.dto';
import { CreateShedDto } from '../dto/create-shed.dto';
import { UpdateShedDto } from '../dto/update-shed.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Settings (PRD Â§21 / API Â§18). `/api/v1/settings`. Token tenancy + RBAC. */
@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // â”€â”€ Farm workspace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Sheds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
}
