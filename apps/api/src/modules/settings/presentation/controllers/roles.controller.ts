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
import { RolesService } from '../../application/services/roles.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  DeleteRoleResponseDto,
  PermissionCatalogueResponseDto,
  RoleListResponseDto,
  RoleResponseDto,
} from '../dto/settings-response.dto';

/**
 * Roles & Permissions (RAKHAL-031, PRD Â§21.4 / API Â§18). `/api/v1/settings`.
 * Read = Manager+ (`settings.read`); mutations = Owner-only (`settings.roles-manage`).
 */
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
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @RequirePermission('settings.read')
  @ApiEnvelopeResponse(PermissionCatalogueResponseDto)
  getCatalogue() {
    return this.rolesService.getCatalogue();
  }

  @Get('roles')
  @RequirePermission('settings.read')
  @ApiEnvelopeResponse(RoleListResponseDto)
  listRoles(@CurrentFarmId() farmId: string) {
    return this.rolesService.listRoles(farmId);
  }

  @Post('roles')
  @RequirePermission('settings.roles-manage')
  @ApiEnvelopeResponse(RoleResponseDto, { status: 201 })
  createRole(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.createRole(farmId, userId, dto);
  }

  @Patch('roles/:id/permissions')
  @RequirePermission('settings.roles-manage')
  @ApiEnvelopeResponse(RoleResponseDto)
  updateRolePermissions(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updateRolePermissions(farmId, userId, id, dto);
  }

  @Delete('roles/:id')
  @RequirePermission('settings.roles-manage')
  @ApiEnvelopeResponse(DeleteRoleResponseDto)
  deleteRole(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.rolesService.deleteRole(farmId, userId, id);
  }
}
