import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { PurchaseService } from '../../application/purchase.service';
import { VoidDocumentUseCase } from '../../application/use-cases/void-document/void-document.use-case';
import { CreatePurchaseDto } from '../dto/create-purchase.dto';
import { ListPurchasesQueryDto } from '../dto/list-purchases-query.dto';

/**
 * Purchasing module (RAKHAL-348, `FINANCE_V2_DESIGN.md` §5.1). Routes
 * resolve under the global prefix as `/api/v1/purchasing/purchases`.
 *
 * Guard chain matches every other Finance V2-adjacent controller
 * (RAKHAL-335/337/339): JwtAuthGuard → SessionGuard → FarmContextGuard →
 * PermissionGuard → SubscriptionGuard. The active farm is taken from the
 * verified token context, never the body.
 *
 * RAKHAL-377 (MILESTONE 22) added `POST :id/void` — `finance.reverse`
 * (owner-only), the only correction mechanism for a posted `Purchase`
 * (see `VoidDocumentUseCase`'s own doc comment).
 */
@ApiTags('Purchasing')
@ApiBearerAuth()
@Controller('purchasing/purchases')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class PurchaseController {
  constructor(
    private readonly purchases: PurchaseService,
    private readonly voidDocument: VoidDocumentUseCase,
  ) {}

  @Post()
  @RequirePermission('purchasing.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.purchases.createPurchase(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('purchasing.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListPurchasesQueryDto,
  ) {
    return this.purchases.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('purchasing.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.purchases.findOne(farmId, id);
  }

  @Post(':id/void')
  @RequirePermission('finance.reverse')
  void(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.voidDocument.voidPurchase(farmId, userId, id);
  }
}
