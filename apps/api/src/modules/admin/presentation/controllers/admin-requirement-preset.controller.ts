import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirementSettingsService } from 'src/modules/feed/application/services/requirement-settings.service';
import {
  CreateRequirementPresetDto,
  UpdateRequirementPresetDto,
} from '../dto/requirement-preset.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  AdminFarmRequirementSettingsResponseDto,
  AdminRequirementPresetDto,
  AdminRequirementPresetListResponseDto,
} from '../dto/admin-requirement-preset-response.dto';

/**
 * Admin Requirement Presets (RAKHAL-410, PRD §12.13 / §19.4).
 *
 * The tuning numbers behind every cow requirement calculation, editable centrally without
 * a redeploy. Farms consume whichever preset is active read-only via
 * `GET /feed/requirement-settings`, and may layer their own changes on top
 * (`PUT /feed/requirement-settings`) — untouched by anything here.
 *
 * Reuses `RequirementSettingsService` directly rather than a parallel admin-side service,
 * the same pattern as `AdminFeedIngredientController` reusing `FeedIngredientService`: the
 * module that owns the data owns the logic, admin adds the guard and audit layer.
 *
 * Two rules this surface enforces, both from PRD §19.4:
 * - **Presets are versioned, not edited.** Once activated a preset is immutable; a change
 *   is a new version. Editing numbers under a set farms already use would make the audit
 *   trail a lie and rollback impossible.
 * - **Activation is non-retroactive.** Nothing already computed is recalculated; only the
 *   per-farm cache is dropped, so the next request picks up the new numbers.
 */
@ApiTags('Admin — Requirement Presets')
@ApiBearerAuth()
@Controller('admin/requirement-presets')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminRequirementPresetController {
  constructor(
    private readonly settings: RequirementSettingsService,
    private readonly audit: AdminAuditService,
  ) {}

  /** Every preset, plus the built-in defaults and field metadata for diffing. */
  @Get()
  @ApiEnvelopeResponse(AdminRequirementPresetListResponseDto)
  @RequireAdminPermission('requirement-preset.read')
  list() {
    return this.settings.listPresets();
  }

  /** Create a new version. Inactive until explicitly activated, so it can be reviewed first. */
  @Post()
  @ApiEnvelopeResponse(AdminRequirementPresetDto, { status: 201 })
  @RequireAdminPermission('requirement-preset.manage')
  async create(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: CreateRequirementPresetDto,
    @Req() req: Request,
  ) {
    const preset = await this.settings.createPreset(admin.id, {
      name: dto.name,
      description: dto.description,
      settings: dto.settings,
      effectiveFrom: dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : undefined,
    });

    await this.audit.record({
      adminId: admin.id,
      action: 'REQUIREMENT_PRESET_CREATED',
      entityType: 'RequirementPreset',
      entityId: preset.id,
      metadata: {
        name: preset.name,
        version: preset.version,
        changed_fields: Object.keys(dto.settings),
      },
      ipAddress: req.ip,
    });

    return preset;
  }

  /** Amend a preset that is not live yet. Rejected with 409 once it has been activated. */
  @Patch(':id')
  @ApiEnvelopeResponse(AdminRequirementPresetDto)
  @RequireAdminPermission('requirement-preset.manage')
  async update(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: UpdateRequirementPresetDto,
    @Req() req: Request,
  ) {
    const preset = await this.settings.updatePreset(admin.id, id, dto);

    await this.audit.record({
      adminId: admin.id,
      action: 'REQUIREMENT_PRESET_UPDATED',
      entityType: 'RequirementPreset',
      entityId: preset.id,
      metadata: {
        name: preset.name,
        version: preset.version,
        changed_fields: dto.settings ? Object.keys(dto.settings) : [],
      },
      ipAddress: req.ip,
    });

    return preset;
  }

  /**
   * Make this preset the one every farm resolves against. Deactivates the incumbent in the
   * same transaction and drops every farm's cached settings.
   */
  @Post(':id/activate')
  @ApiEnvelopeResponse(AdminRequirementPresetDto, { status: 201 })
  @RequireAdminPermission('requirement-preset.manage')
  async activate(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const preset = await this.settings.activatePreset(admin.id, id);

    await this.audit.record({
      adminId: admin.id,
      action: 'REQUIREMENT_PRESET_ACTIVATED',
      entityType: 'RequirementPreset',
      entityId: preset.id,
      metadata: { name: preset.name, version: preset.version },
      ipAddress: req.ip,
    });

    return preset;
  }

  /** What one farm has changed on top of the active preset — support visibility. */
  @Get('farms/:farmId')
  @ApiEnvelopeResponse(AdminFarmRequirementSettingsResponseDto)
  @RequireAdminPermission('requirement-preset.read')
  farmSettings(@Param('farmId') farmId: string) {
    return this.settings.farmSettingsForAdmin(farmId);
  }
}
