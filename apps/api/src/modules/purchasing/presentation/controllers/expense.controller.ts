import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ExpenseService } from '../../application/expense.service';
import { RecordExpenseDto } from '../dto/record-expense.dto';

/**
 * Purchasing module → Expenses (RAKHAL-348, `FINANCE_V2_DESIGN.md` §5.1).
 * Routes resolve under the global prefix as `/api/v1/purchasing/expenses`.
 * Guard chain + permission reuse identical to `PurchaseController`.
 */
@ApiTags('Purchasing')
@ApiBearerAuth()
@Controller('purchasing/expenses')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @Post()
  @RequirePermission('purchasing.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: RecordExpenseDto,
  ) {
    return this.expenses.recordExpense(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('purchasing.read')
  findAll(@CurrentFarmId() farmId: string) {
    return this.expenses.findAll(farmId);
  }

  @Get(':id')
  @RequirePermission('purchasing.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.expenses.findOne(farmId, id);
  }
}
