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
import { WorkspaceSettingsService } from '../../application/services/workspace-settings.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { CreateServiceProviderDto } from '../dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from '../dto/update-service-provider.dto';
import { UpdateModuleSettingsDto } from '../dto/update-module-settings.dto';
import { UpdateMilkSessionsDto } from '../dto/update-milk-sessions.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  BillingResponseDto,
  MilkSessionsSettingsDto,
  ModulesSettingsResponseDto,
  ServiceProviderListResponseDto,
  ServiceProviderResponseDto,
  SoftDeleteResponseDto,
  SupplierListResponseDto,
  SupplierResponseDto,
} from '../dto/settings-response.dto';

/** Settings â†’ Modules / Suppliers / Billing (PRD Â§21.5â€“21.7 / API Â§18). `/api/v1/settings`. */
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
export class WorkspaceSettingsController {
  constructor(private readonly workspace: WorkspaceSettingsService) {}

  // â”€â”€ Module settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('modules')
  @RequirePermission('settings.read')
  @ApiEnvelopeResponse(ModulesSettingsResponseDto)
  getModules(@CurrentFarmId() farmId: string) {
    return this.workspace.getModules(farmId);
  }

  @Patch('modules')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(ModulesSettingsResponseDto)
  updateModules(
    @CurrentFarmId() farmId: string,
    @Body() dto: UpdateModuleSettingsDto,
  ) {
    return this.workspace.updateModules(farmId, dto);
  }

  // Split from `PATCH modules` — owner-only, so a Manager (who holds the
  // general `settings.update`) can't unlock extra milking sessions on their own.
  @Patch('modules/milk-sessions')
  @RequirePermission('settings.milk-sessions-manage')
  @ApiEnvelopeResponse(MilkSessionsSettingsDto)
  updateMilkSessions(
    @CurrentFarmId() farmId: string,
    @Body() dto: UpdateMilkSessionsDto,
  ) {
    return this.workspace.updateMilkSessions(farmId, dto);
  }

  // â”€â”€ Suppliers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @Get('suppliers')
  @RequirePermission('settings.read')
  @ApiEnvelopeResponse(SupplierListResponseDto)
  listSuppliers(@CurrentFarmId() farmId: string) {
    return this.workspace.listSuppliers(farmId);
  }

  @Post('suppliers')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(SupplierResponseDto, { status: 201 })
  createSupplier(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.workspace.createSupplier(farmId, dto, userId);
  }

  @Patch('suppliers/:id')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(SupplierResponseDto)
  updateSupplier(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.workspace.updateSupplier(farmId, id, dto, userId);
  }

  @Delete('suppliers/:id')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(SoftDeleteResponseDto)
  deleteSupplier(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.workspace.deleteSupplier(farmId, id, userId);
  }

  // ── Service Providers ───────────────────────────────────────────────────────

  @Get('service-providers')
  @RequirePermission('settings.read')
  @ApiEnvelopeResponse(ServiceProviderListResponseDto)
  listServiceProviders(@CurrentFarmId() farmId: string) {
    return this.workspace.listServiceProviders(farmId);
  }

  @Post('service-providers')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(ServiceProviderResponseDto, { status: 201 })
  createServiceProvider(
    @CurrentFarmId() farmId: string,
    @Body() dto: CreateServiceProviderDto,
  ) {
    return this.workspace.createServiceProvider(farmId, dto);
  }

  @Patch('service-providers/:id')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(ServiceProviderResponseDto)
  updateServiceProvider(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceProviderDto,
  ) {
    return this.workspace.updateServiceProvider(farmId, id, dto);
  }

  @Delete('service-providers/:id')
  @RequirePermission('settings.update')
  @ApiEnvelopeResponse(SoftDeleteResponseDto)
  deleteServiceProvider(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
  ) {
    return this.workspace.deleteServiceProvider(farmId, id);
  }

  // â”€â”€ Billing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€--

  @Get('billing')
  @RequirePermission('settings.billing')
  @ApiEnvelopeResponse(BillingResponseDto)
  getBilling(@CurrentFarmId() farmId: string) {
    return this.workspace.getBilling(farmId);
  }
}
