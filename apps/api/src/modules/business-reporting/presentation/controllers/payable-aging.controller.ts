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
 * `/api/v1/purchasing/payables/aging` — lives under the pre-existing
 * `purchasing/payables` path, mirroring `ReceivableAgingController`. Same
 * `purchasing.read` permission `PayableController` already uses for reads.
 */
@ApiTags('Business Reporting')
@ApiBearerAuth()
@Controller('purchasing/payables')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class PayableAgingController {
  constructor(private readonly aging: AgingService) {}

  @Get('aging')
  @RequirePermission('purchasing.read')
  getAging(@CurrentFarmId() farmId: string, @Query() query: AgingQueryDto) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    return this.aging.getPayablesAging(farmId, asOf);
  }
}
