import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { AdminAuditService } from '../../application/services/admin-audit.service';
import { ListAdminAuditQueryDto } from '../dto/list-admin-audit.dto';
import { ApiPaginatedResponse } from 'src/common/swagger/api-envelope';
import { AdminAuditLogDto } from '../dto/admin-system-response.dto';

/**
 * Read surface for the immutable admin audit trail (RAKHAL-225, ADM-03,
 * PRD §35.3). Every admin write across `/admin/*` lands here via
 * `AdminAuditService.record`.
 */
@ApiTags('Admin — Audit')
@ApiBearerAuth()
@Controller('admin/audit')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @ApiPaginatedResponse(AdminAuditLogDto)
  @RequireAdminPermission('audit.read')
  list(@Query() query: ListAdminAuditQueryDto) {
    return this.audit.list(query);
  }
}
