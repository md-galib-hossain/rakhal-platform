import {
  Body,
  Controller,
  Get,
  Param,
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
import { ReproProtocolService } from '../../application/services/repro-protocol.service';
import {
  ApplyProtocolDto,
  CloseInstanceDto,
  ListInstanceQueryDto,
  RecordAiDto,
  RecordOutcomeDto,
} from '../dto/protocol.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Reproductive (Synchronization) Protocols (RAKHAL-214, PRD Â§9.8 / Â§9.9).
 * `/api/v1/reproduction/protocols`. Token tenancy + RBAC: read = Manager+
 * (`reproduction.read`), apply = `reproduction.create`, instance actions =
 * `reproduction.update`.
 */
@ApiTags('Reproduction')
@ApiBearerAuth()
@Controller('reproduction/protocols')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ReproProtocolController {
  constructor(private readonly protocols: ReproProtocolService) {}

  @Get()
  @RequirePermission('reproduction.read')
  list(@CurrentFarmId() farmId: string) {
    return this.protocols.listProtocols(farmId);
  }

  @Get('kpis')
  @RequirePermission('reproduction.read')
  kpis(@CurrentFarmId() farmId: string) {
    return this.protocols.kpis(farmId);
  }

  @Get('instances')
  @RequirePermission('reproduction.read')
  listInstances(
    @CurrentFarmId() farmId: string,
    @Query() query: ListInstanceQueryDto,
  ) {
    return this.protocols.listInstances(farmId, query);
  }

  @Get('instances/:id')
  @RequirePermission('reproduction.read')
  getInstance(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.protocols.getInstance(farmId, id);
  }

  @Post('apply')
  @RequirePermission('reproduction.create')
  apply(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ApplyProtocolDto,
  ) {
    return this.protocols.apply(farmId, userId, dto);
  }

  @Post('instances/:id/ai')
  @RequirePermission('reproduction.update')
  recordAi(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RecordAiDto,
  ) {
    return this.protocols.recordAi(farmId, userId, id, dto);
  }

  @Post('instances/:id/outcome')
  @RequirePermission('reproduction.update')
  recordOutcome(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RecordOutcomeDto,
  ) {
    return this.protocols.recordOutcome(farmId, userId, id, dto);
  }

  @Post('instances/:id/close')
  @RequirePermission('reproduction.update')
  closeInstance(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CloseInstanceDto,
  ) {
    return this.protocols.closeInstance(farmId, userId, id, dto);
  }

  @Get(':id')
  @RequirePermission('reproduction.read')
  getProtocol(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.protocols.getProtocol(farmId, id);
  }
}
