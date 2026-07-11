import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ReconciliationService } from 'src/modules/billing/application/services/reconciliation.service';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';
import {
  ListReconciliationQueryDto,
  ResolveReconciliationDto,
} from '../dto/reconciliation.dto';

/**
 * Settlement-reconciliation console (RAKHAL-239, PRD §36.4). `admin-api`, behind
 * `PlatformAdminGuard`. The daily scheduler runs reconciliation automatically;
 * this exposes the exception report + a manual re-run + the resolve/ignore
 * actions (audited). The service is read-only to the ledger — resolving an
 * exception records the human decision, it never edits a payment.
 */
@ApiTags('Admin — Reconciliation')
@ApiBearerAuth()
@Controller('admin/reconciliation')
@UseGuards(PlatformAdminGuard, AdminPermissionGuard)
export class AdminReconciliationController {
  constructor(
    private readonly reconciliation: ReconciliationService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @RequireAdminPermission('reconciliation.read')
  list(@Query() query: ListReconciliationQueryDto) {
    return this.reconciliation.list({ status: query.status, type: query.type });
  }

  @Post('run')
  @RequireAdminPermission('reconciliation.manage')
  async run(@CurrentAdmin() admin: CurrentAdminContext, @Req() req: Request) {
    const result = await this.reconciliation.runReconciliation();
    await this.audit.record({
      adminId: admin.id,
      action: 'RECONCILIATION_RUN',
      entityType: 'ReconciliationException',
      metadata: result,
      ipAddress: req.ip,
    });
    return result;
  }

  @Post(':id/resolve')
  @RequireAdminPermission('reconciliation.manage')
  async resolve(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: ResolveReconciliationDto,
    @Req() req: Request,
  ) {
    const exception = await this.reconciliation.resolve(
      id,
      admin.id,
      dto.status,
      dto.note,
    );
    await this.audit.record({
      adminId: admin.id,
      action: 'RECONCILIATION_RESOLVED',
      entityType: 'ReconciliationException',
      entityId: id,
      metadata: { status: dto.status },
      ipAddress: req.ip,
    });
    return exception;
  }
}
