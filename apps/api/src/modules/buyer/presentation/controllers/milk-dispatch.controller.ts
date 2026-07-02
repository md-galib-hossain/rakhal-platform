import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { BuyerService } from '../../application/services/buyer.service';
import { RecordDispatchDto } from '../dto/record-dispatch.dto';
import { DispatchQueryDto } from '../dto/dispatch-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Milk dispatch (PRD §11.2). `/api/v1/milk/dispatch`. Token tenancy + RBAC. */
@ApiTags('Milk Dispatch')
@ApiBearerAuth()
@Controller('milk/dispatch')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class MilkDispatchController {
  constructor(private readonly buyerService: BuyerService) {}

  @Post()
  @RequirePermission('finance.create')
  record(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: RecordDispatchDto,
  ) {
    return this.buyerService.recordDispatch(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('finance.read')
  history(@CurrentFarmId() farmId: string, @Query() query: DispatchQueryDto) {
    return this.buyerService.listDispatches(farmId, query);
  }
}
