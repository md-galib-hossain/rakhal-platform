import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BuyerService } from '../../application/services/buyer.service';
import { CreateBuyerDto } from '../dto/create-buyer.dto';
import { UpdateBuyerDto } from '../dto/update-buyer.dto';
import { ListBuyerQueryDto } from '../dto/list-buyer-query.dto';
import { DispatchQueryDto, StatementQueryDto } from '../dto/dispatch-query.dto';
import { RecordReceiptDto } from '../dto/record-receipt.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Milk buyers (PRD Â§11). `/api/v1/buyers`. Token tenancy + RBAC. Milk sales are
 * a revenue concern, so buyer management is gated behind `finance.*`.
 */
@ApiTags('Milk Buyers')
@ApiBearerAuth()
@Controller('buyers')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class BuyerController {
  constructor(private readonly buyerService: BuyerService) {}

  @Get()
  @RequirePermission('finance.read')
  list(@CurrentFarmId() farmId: string, @Query() query: ListBuyerQueryDto) {
    return this.buyerService.listBuyers(farmId, query);
  }

  @Post()
  @RequirePermission('finance.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateBuyerDto,
  ) {
    return this.buyerService.createBuyer(farmId, userId, dto);
  }

  // RAKHAL-372: `summary`/`groups` are literal path segments and must be
  // registered before `GET :id` below — Nest/Express matches routes in
  // registration order, not by specificity, so a param route registered
  // first would swallow `/buyers/summary` as `id: 'summary'`.
  @Get('summary')
  @RequirePermission('finance.read')
  summary(@CurrentFarmId() farmId: string) {
    return this.buyerService.getBuyersSummary(farmId);
  }

  @Get('groups')
  @RequirePermission('finance.read')
  groups(@CurrentFarmId() farmId: string) {
    return this.buyerService.getBuyerGroups(farmId);
  }

  // RAKHAL-378: dispatch lifecycle routes. `dispatches`/`dispatches/summary`
  // are literal segments and, per the same Nest/Express registration-order
  // rule the `summary`/`groups` comment above documents, must be registered
  // before `GET :id` below.
  @Get('dispatches')
  @RequirePermission('finance.read')
  listDispatches(
    @CurrentFarmId() farmId: string,
    @Query() query: DispatchQueryDto,
  ) {
    return this.buyerService.listDispatches(farmId, query);
  }

  @Get('dispatches/summary')
  @RequirePermission('finance.read')
  dispatchesSummary(@CurrentFarmId() farmId: string) {
    return this.buyerService.getDispatchesSummary(farmId);
  }

  @Patch('dispatches/:id/receipt')
  @RequirePermission('finance.update')
  recordReceipt(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RecordReceiptDto,
  ) {
    return this.buyerService.recordReceipt(farmId, id, dto);
  }

  // RAKHAL-377 (MILESTONE 22): the only correction mechanism for a
  // MilkDispatch — cascades into cancelling its posted Sale, if any (see
  // `BuyerService.cancelDispatch`'s own doc comment). `finance.reverse`
  // (owner-only), same tier every other void route in this milestone uses.
  @Post('dispatches/:id/cancel')
  @RequirePermission('finance.reverse')
  cancelDispatch(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.buyerService.cancelDispatch(farmId, userId, id);
  }

  @Get(':id/statement')
  @RequirePermission('finance.read')
  statement(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.buyerService.statement(farmId, id, query);
  }

  @Get(':id/overview')
  @RequirePermission('finance.read')
  overview(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.buyerService.getBuyerOverview(farmId, id);
  }

  @Get(':id')
  @RequirePermission('finance.read')
  getOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.buyerService.getBuyer(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('finance.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBuyerDto,
  ) {
    return this.buyerService.updateBuyer(farmId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('finance.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.buyerService.deactivateBuyer(farmId, id);
  }
}
