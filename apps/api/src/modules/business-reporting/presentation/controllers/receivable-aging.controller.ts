import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { AgingService } from '../../application/aging.service';
import { AgingQueryDto } from '../dto/aging-query.dto';

/**
 * RAKHAL-369 (MILESTONE 22). Route resolves as
 * `/api/v1/finance/receivables/aging` — lives under the pre-existing
 * `finance/receivables` path (matching the mockup's own URL), even though
 * the implementation lives in the new `business-reporting` leaf module.
 * Same guard chain / `finance.read` permission every other Finance V2 read
 * route already uses (`ReceivableController`).
 */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('finance/receivables')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ReceivableAgingController {
  constructor(private readonly aging: AgingService) {}

  @Get('aging')
  @RequirePermission('finance.read')
  getAging(@CurrentFarmId() farmId: string, @Query() query: AgingQueryDto) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    return this.aging.getReceivablesAging(farmId, asOf);
  }
}
