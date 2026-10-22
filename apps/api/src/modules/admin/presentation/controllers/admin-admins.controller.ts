import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleWrite } from 'src/common/decorators';
import { AdminManagementService } from '../../application/services/admin-management.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { CreateAdminDto, UpdateAdminDto } from '../dto/admin-lifecycle.dto';
import { ListAdminsQueryDto } from '../dto/list-admins.dto';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

/**
 * Platform-admin lifecycle (P2-05). `admin.read` / `admin.manage` — held only by
 * SUPER_ADMIN (wildcard). Every mutation is audited with before/after inside
 * `AdminManagementService`; temporary passwords are returned once and never stored.
 */
@ApiTags('Admin — Admins')
@ApiBearerAuth()
@Controller('admin/admins')
@ThrottleWrite()
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminAdminsController {
  constructor(private readonly admins: AdminManagementService) {}

  @Get()
  @RequireAdminPermission('admin.read')
  list(@Query() query: ListAdminsQueryDto) {
    return this.admins.list(query);
  }

  @Get(':id')
  @RequireAdminPermission('admin.read')
  get(@Param('id') id: string) {
    return this.admins.get(id);
  }

  @Post()
  @RequireAdminPermission('admin.manage')
  create(
    @CurrentAdmin() actor: CurrentAdminContext,
    @Body() dto: CreateAdminDto,
  ) {
    return this.admins.create(actor.id, dto);
  }

  @Patch(':id')
  @RequireAdminPermission('admin.manage')
  update(
    @CurrentAdmin() actor: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.admins.update(actor.id, id, dto);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequireAdminPermission('admin.manage')
  deactivate(
    @CurrentAdmin() actor: CurrentAdminContext,
    @Param('id') id: string,
  ) {
    return this.admins.deactivate(actor.id, id);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequireAdminPermission('admin.manage')
  activate(
    @CurrentAdmin() actor: CurrentAdminContext,
    @Param('id') id: string,
  ) {
    return this.admins.activate(actor.id, id);
  }

  @Post(':id/reset-2fa')
  @HttpCode(200)
  @RequireAdminPermission('admin.manage')
  resetTwoFactor(
    @CurrentAdmin() actor: CurrentAdminContext,
    @Param('id') id: string,
  ) {
    return this.admins.resetTwoFactor(actor.id, id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequireAdminPermission('admin.manage')
  resetPassword(
    @CurrentAdmin() actor: CurrentAdminContext,
    @Param('id') id: string,
  ) {
    return this.admins.resetPassword(actor.id, id);
  }
}
