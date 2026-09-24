import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { LactationStatsService } from '../application/services/lactation-stats.service';
import { LactationEconomicsService } from '../application/services/lactation-economics.service';
import { LactationCurveQueryDto } from './dto/lactation-curve-query.dto';
import { UpdatePlannedDryOffDto } from './dto/update-planned-dry-off.dto';
import { CompareLactationQueryDto } from './dto/compare-lactation-query.dto';
import { CompareLactationGroupsQueryDto } from './dto/compare-lactation-groups-query.dto';

/**
 * Lactation stats + curve (RAKHAL-283). `/api/v1/reproduction/lactations`.
 * Mostly read-only, derived from `MilkLogEntry` — no new stored columns for
 * stats/curve. Reuses the `reproduction.read` permission key (the same key
 * every other GET route in this module already uses —
 * `ReproductionController.listLactations`, `.dashboard`, `.events`, etc.)
 * rather than inventing a narrower `reproduction.lactation.read`, since no
 * such finer-grained key exists anywhere else in the reproduction module's
 * permission surface. RAKHAL-285 added one write route
 * (`PATCH .../planned-dry-off`, `reproduction.update`) for the farmer-set
 * planned dry-off date — `GET .../stats` now also surfaces the
 * system-computed `recommendedDryOffAt` projection alongside it.
 */
@ApiTags('Reproduction')
@ApiBearerAuth()
@Controller('reproduction/lactations')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class LactationController {
  constructor(
    private readonly lactationStatsService: LactationStatsService,
    private readonly lactationEconomicsService: LactationEconomicsService,
  ) {}

  /**
   * RAKHAL-287: current vs. previous lactation for one cow, DIM-aligned.
   * Registered ahead of the `:id/...` routes below (specific literal paths
   * before param routes) — `compare`/`compare/groups` never has a literal
   * second segment of `stats`/`curve`/`planned-dry-off` so there's no real
   * ambiguity, but this ordering keeps intent obvious.
   */
  @Get('compare')
  @RequirePermission('reproduction.read')
  compareLactations(
    @CurrentFarmId() farmId: string,
    @Query() query: CompareLactationQueryDto,
  ) {
    return this.lactationStatsService.compareLactations(
      farmId,
      query.cattleId,
      query.byLactationNumber ?? true,
    );
  }

  /** Farm-level average yield/peak/persistency, bucketed by parity/shed/dimRange. */
  @Get('compare/groups')
  @RequirePermission('reproduction.read')
  compareGroups(
    @CurrentFarmId() farmId: string,
    @Query() query: CompareLactationGroupsQueryDto,
  ) {
    return this.lactationStatsService.compareGroups(farmId, query.groupBy);
  }

  /** Today/7-day-avg/30-day-avg yield + lactation-to-date totals by MilkDisposition. */
  @Get(':id/stats')
  @RequirePermission('reproduction.read')
  getStats(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.lactationStatsService.getStats(farmId, id);
  }

  /** Daily-yield-by-DIM series for charting; optional `compareLactationId` for a second aligned series. */
  @Get(':id/curve')
  @RequirePermission('reproduction.read')
  getCurve(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: LactationCurveQueryDto,
  ) {
    return this.lactationStatsService.getCurve(
      farmId,
      id,
      query.compareLactationId,
    );
  }

  /**
   * RAKHAL-289: milk revenue minus allocated feed/medicine/breeding/
   * discarded-withheld-milk cost, alongside the biological view — the two
   * are returned side by side, never blended into one score.
   */
  @Get(':id/economics')
  @RequirePermission('reproduction.read')
  getEconomics(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.lactationEconomicsService.getEconomics(farmId, id);
  }

  /**
   * RAKHAL-285: farmer-set/adjustable target dry-off date, independent of
   * the system-computed `recommendedDryOffAt` (`GET .../stats`) — never
   * overwritten by the pregnancy-driven recompute. Reuses `reproduction.update`
   * (the same key every other write in this module uses — manager+, matching
   * the repo's read=worker-ok/write=manager+ convention).
   */
  @Patch(':id/planned-dry-off')
  @RequirePermission('reproduction.update')
  updatePlannedDryOff(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlannedDryOffDto,
  ) {
    return this.lactationStatsService.updatePlannedDryOff(
      farmId,
      id,
      dto.plannedDryOffAt ? new Date(dto.plannedDryOffAt) : null,
    );
  }
}
