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
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { WorkspaceSettingsService } from '../../application/services/workspace-settings.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { UpdateModuleSettingsDto } from '../dto/update-module-settings.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Settings → Modules / Suppliers / Billing (PRD §21.5–21.7 / API §18). `/api/v1/settings`. */
@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class WorkspaceSettingsController {
  constructor(private readonly workspace: WorkspaceSettingsService) {}

  // ── Module settings ─────────────────────────────────────────────────────────

  @Get('modules')
  @RequirePermission('settings.read')
  getModules(@CurrentFarmId() farmId: string) {
    return this.workspace.getModules(farmId);
  }

  @Patch('modules')
  @RequirePermission('settings.update')
  updateModules(
    @CurrentFarmId() farmId: string,
    @Body() dto: UpdateModuleSettingsDto,
  ) {
    return this.workspace.updateModules(farmId, dto);
  }

  // ── Suppliers ───────────────────────────────────────────────────────────────

  @Get('suppliers')
  @RequirePermission('settings.read')
  listSuppliers(@CurrentFarmId() farmId: string) {
    return this.workspace.listSuppliers(farmId);
  }

  @Post('suppliers')
  @RequirePermission('settings.update')
  createSupplier(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.workspace.createSupplier(farmId, dto);
  }

  @Patch('suppliers/:id')
  @RequirePermission('settings.update')
  updateSupplier(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.workspace.updateSupplier(farmId, id, dto);
  }

  @Delete('suppliers/:id')
  @RequirePermission('settings.update')
  deleteSupplier(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.workspace.deleteSupplier(farmId, id);
  }

  // ── Billing ───────────────────────────────────────────────────────────────--

  @Get('billing')
  @RequirePermission('settings.billing')
  getBilling(@CurrentFarmId() farmId: string) {
    return this.workspace.getBilling(farmId);
  }
}
