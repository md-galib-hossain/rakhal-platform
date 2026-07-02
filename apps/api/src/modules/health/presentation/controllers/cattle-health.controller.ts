import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { HealthService } from '../../application/services/health.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Per-animal health summary (PRD §13). `/api/v1/cattle/:id/health-summary`. */
@ApiTags('Health')
@ApiBearerAuth()
@Controller('cattle')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class CattleHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(':id/health-summary')
  @RequirePermission('healthcare.read')
  summary(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.healthService.getCattleHealthSummary(farmId, id);
  }
}
