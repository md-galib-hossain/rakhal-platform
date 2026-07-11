import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { AdminAuditService } from '../../application/services/admin-audit.service';
import { ListAdminAuditQueryDto } from '../dto/list-admin-audit.dto';

/**
 * Read surface for the immutable admin audit trail (RAKHAL-225, ADM-03,
 * PRD §35.3). Every admin write across `/admin/*` lands here via
 * `AdminAuditService.record`.
 */
@ApiTags('Admin — Audit')
@ApiBearerAuth()
@Controller('admin/audit')
@UseGuards(PlatformAdminGuard, AdminPermissionGuard)
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @RequireAdminPermission('audit.read')
  list(@Query() query: ListAdminAuditQueryDto) {
    return this.audit.list(query);
  }
}
