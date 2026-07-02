import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ActivityLogService } from '../../application/services/activity-log.service';
import { AqrService } from '../../application/services/aqr.service';
import { ListActivityQueryDto } from '../dto/list-activity-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Activity Log + AQR read surface. `/api/v1/activity-log`. Token tenancy + RBAC.
 * The log is read-only by design — there is no create/update/delete endpoint
 * (entries are written by other modules via ActivityLogService, PRD §19.3).
 */
@ApiTags('Activity Log')
@ApiBearerAuth()
@Controller('activity-log')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class ActivityController {
  constructor(
    private readonly activityLog: ActivityLogService,
    private readonly aqr: AqrService,
  ) {}

  @Get()
  @RequirePermission('activity.read')
  list(@CurrentFarmId() farmId: string, @Query() query: ListActivityQueryDto) {
    return this.activityLog.list(farmId, query);
  }

  @Get('herd-aqr')
  @RequirePermission('cattle.read')
  herdAqr(@CurrentFarmId() farmId: string) {
    return this.aqr.herdAqr(farmId).then((avgAqr) => ({ herdAqr: avgAqr }));
  }

  @Get('verify-chain')
  @RequirePermission('activity.read')
  verifyChain(@CurrentFarmId() farmId: string) {
    return this.activityLog.verifyChain(farmId);
  }
}
