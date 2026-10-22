import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminDirectoryService } from '../../application/services/admin-directory.service';
import {
  AdminAuthenticatedOnly,
  RequireAdminPermission,
} from '../decorators/require-admin-permission.decorator';
import {
  ListAdminFarmsQueryDto,
  ListAdminUsersQueryDto,
} from '../dto/admin-directory.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';

/**
 * Phase 3 read-only directory: find a farm or user and see their account state,
 * plus platform counters. `farm.read` / `user.read`; the overview carries only
 * aggregate counts so any signed-in admin may read it.
 */
@ApiTags('Admin — Directory')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminDirectoryController {
  constructor(private readonly directory: AdminDirectoryService) {}

  @Get('overview')
  @AdminAuthenticatedOnly()
  overview() {
    return this.directory.overview();
  }

  @Get('farms')
  @RequireAdminPermission('farm.read')
  listFarms(@Query() query: ListAdminFarmsQueryDto) {
    return this.directory.listFarms(query);
  }

  @Get('farms/:id')
  @RequireAdminPermission('farm.read')
  getFarm(@Param('id') id: string) {
    return this.directory.getFarm(id);
  }

  @Get('users')
  @RequireAdminPermission('user.read')
  listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.directory.listUsers(query);
  }

  @Get('users/:id')
  @RequireAdminPermission('user.read')
  getUser(@Param('id') id: string) {
    return this.directory.getUser(id);
  }
}
