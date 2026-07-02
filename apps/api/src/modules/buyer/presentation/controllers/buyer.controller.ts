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
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BuyerService } from '../../application/services/buyer.service';
import { CreateBuyerDto } from '../dto/create-buyer.dto';
import { UpdateBuyerDto } from '../dto/update-buyer.dto';
import { ListBuyerQueryDto } from '../dto/list-buyer-query.dto';
import { StatementQueryDto } from '../dto/dispatch-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Milk buyers (PRD §11). `/api/v1/buyers`. Token tenancy + RBAC. Milk sales are
 * a revenue concern, so buyer management is gated behind `finance.*`.
 */
@ApiTags('Milk Buyers')
@ApiBearerAuth()
@Controller('buyers')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
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

  @Get(':id/statement')
  @RequirePermission('finance.read')
  statement(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: StatementQueryDto,
  ) {
    return this.buyerService.statement(farmId, id, query);
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
