import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SupplierReadService } from '../../application/supplier-read.service';

/**
 * RAKHAL-373 — read-only, `/settings/suppliers` still owns the writes.
 * `summary` is a distinct sub-path (`/purchasing/suppliers/summary`), not a
 * `:id` param — no route-registration-order hazard on this controller.
 */
@ApiTags('Purchasing')
@ApiBearerAuth()
@Controller('purchasing/suppliers')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class SupplierReadController {
  constructor(private readonly suppliers: SupplierReadService) {}

  @Get()
  @RequirePermission('purchasing.read')
  list(@CurrentFarmId() farmId: string) {
    return this.suppliers.listSuppliers(farmId);
  }

  @Get('summary')
  @RequirePermission('purchasing.read')
  summary(@CurrentFarmId() farmId: string) {
    return this.suppliers.getSummary(farmId);
  }
}
