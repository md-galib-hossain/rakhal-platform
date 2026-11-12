import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { HealthService } from '../../application/services/health.service';
import { StopCattleProtocolDto } from '../dto/stop-protocol.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import { CattleHealthSummaryResponseDto } from '../dto/health-response.dto';

/** Per-animal health: summary (PRD §13) + the protocols the animal is on. `/api/v1/cattle/:id/...`. */
@ApiTags('Health')
@ApiBearerAuth()
@Controller('cattle')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class CattleHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(':id/health-summary')
  @RequirePermission('healthcare.read')
  @ApiEnvelopeResponse(CattleHealthSummaryResponseDto)
  summary(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.getCattleHealthSummary(farmId, id);
  }

  /** Every protocol this animal is on right now (treatment on a case + preventive/breeding rounds). */
  @Get(':id/protocols')
  @RequirePermission('healthcare.read')
  protocols(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.getCattleProtocols(farmId, id);
  }

  /** Take this animal off one protocol; its remaining open steps are skipped. */
  @Post(':id/protocols/stop')
  @HttpCode(200)
  @RequirePermission('healthcare.update')
  stopProtocol(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: StopCattleProtocolDto,
  ) {
    return this.healthService.stopCattleProtocol(farmId, id, dto);
  }

  /**
   * Cancel one application on this animal as a mistake, in one call: every recorded dose is reversed (stock back, expense
   * reversed, withdrawal cancelled) and every step deleted. Use `protocols/stop` instead to keep what already happened.
   */
  @Post(':id/protocols/cancel')
  @HttpCode(200)
  @RequirePermission('healthcare.update')
  cancelProtocol(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: StopCattleProtocolDto,
  ) {
    return this.healthService.cancelAnimalProtocol(farmId, userId, id, dto);
  }
}
