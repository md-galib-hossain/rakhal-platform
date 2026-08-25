import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ReceivableService } from '../../application/receivable.service';
import { ListReceivablesQueryDto } from '../dto/list-receivables-query.dto';

/**
 * Finance V2 → Receivables (RAKHAL-340, `FINANCE_V2_DESIGN.md` §4.3, §4.6).
 * Routes resolve under the global prefix as `/api/v1/finance/receivables`.
 * Read-only surface — `Receivable` rows are created by the sale-type use
 * cases (RAKHAL-342/345/346/347), never directly via this controller.
 *
 * Guard chain matches every other Finance V2 controller (RAKHAL-335/336/337):
 * JwtAuthGuard → SessionGuard → FarmContextGuard → PermissionGuard →
 * SubscriptionGuard. The active farm is taken from the verified token
 * context, never a query/body param.
 *
 * Reuses `finance.read` (same permission key `PaymentController`/
 * `FinancialAccountController` already gate reads with) rather than
 * inventing a new key — RAKHAL-337/339's own permission choices
 * (`finance.read`/`finance.create`, `sales.read`/`sales.create`) confirm
 * this module reuses the existing Finance permission group rather than
 * introducing a receivables-specific one.
 */
@ApiTags('Finance V2')
@ApiBearerAuth()
@Controller('finance/receivables')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ReceivableController {
  constructor(private readonly receivables: ReceivableService) {}

  @Get()
  @RequirePermission('finance.read')
  list(
    @CurrentFarmId() farmId: string,
    @Query() query: ListReceivablesQueryDto,
  ) {
    return this.receivables.listReceivables(farmId, query);
  }

  @Get(':id')
  @RequirePermission('finance.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.receivables.findOne(farmId, id);
  }
}
