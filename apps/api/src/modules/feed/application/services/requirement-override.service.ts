import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityLogModule,
  CattleRequirementOverride,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { SetRequirementOverrideDto } from '../../presentation/dto/set-requirement-override.dto';
import { RequirementOverrideHistoryQueryDto } from '../../presentation/dto/requirement-override-history-query.dto';
import { FeedRequirementsService } from './feed-requirements.service';

export interface OverrideWarning {
  code: 'dm_body_weight' | 'cp_share' | 'energy_density';
  message: string;
}

/**
 * Per-cow manual requirement override (MILESTONE 28, RAKHAL-462, PRD §12.17, ADR-028).
 *
 * Manual is on ⇔ the cow has a row with `effectiveTo IS NULL` (partial unique index). Rows are immutable apart
 * from being closed: PUT closes the open row (`REPLACED`) and opens a new one in one transaction, DELETE closes it
 * (`TURNED_OFF`). `effectiveFrom` is always the server's now — no backdating. Resolution of the override for every
 * requirement path lives in `FeedRequirementsService`; this service only writes and lists.
 */
@Injectable()
export class RequirementOverrideService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
    private readonly requirements: FeedRequirementsService,
    private readonly activityLog: ActivityLogService,
  ) {
    this.log = logger.setContext(RequirementOverrideService.name);
  }

  /** The open row, the resolved per-cow requirement, and the newest closed row (to pre-fill "turn back on"). */
  async get(farmId: string, cattleId: string) {
    const resolved = await this.requireResolved(farmId, cattleId);
    const [active, last] = await Promise.all([
      this.prisma.cattleRequirementOverride.findFirst({
        where: { farmId, cattleId, effectiveTo: null },
      }),
      this.prisma.cattleRequirementOverride.findFirst({
        where: { farmId, cattleId, effectiveTo: { not: null } },
        orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      }),
    ]);
    return {
      active: active ? this.rowShape(active) : null,
      resolved: resolved.shaped,
      last: last ? this.rowShape(last) : null,
    };
  }

  async history(
    farmId: string,
    cattleId: string,
    query: RequirementOverrideHistoryQueryDto,
  ) {
    await this.requireCow(farmId, cattleId);
    const rows = await this.prisma.cattleRequirementOverride.findMany({
      where: { farmId, cattleId },
      orderBy: [{ effectiveFrom: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return { ...page, items: page.items.map((r) => this.rowShape(r)) };
  }

  async set(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: SetRequirementOverrideDto,
  ) {
    if (dto.cpKg >= dto.dmKg) {
      throw new BadRequestException(
        'Crude protein must be less than dry matter',
      );
    }
    const cow = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: { id: true, tagNumber: true, lastWeightKg: true },
    });
    if (!cow) throw new NotFoundException('Cattle not found');

    // What the engine says right now — frozen into the row so staleness can be judged later (D6).
    const before = await this.requireResolved(farmId, cattleId);

    const write = () =>
      this.prisma.$transaction(async (tx) => {
        const now = new Date();
        await tx.cattleRequirementOverride.updateMany({
          where: { farmId, cattleId, effectiveTo: null },
          data: { effectiveTo: now, endReason: 'REPLACED', endedBy: userId },
        });
        return tx.cattleRequirementOverride.create({
          data: {
            farmId,
            cattleId,
            dmKg: dto.dmKg,
            cpKg: dto.cpKg,
            meMj: dto.meMj,
            note: dto.note ?? null,
            dynamicSnapshot:
              before.snapshot as unknown as Prisma.InputJsonValue,
            effectiveFrom: now,
            setBy: userId,
          },
        });
      });

    let created: CattleRequirementOverride;
    try {
      created = await write();
    } catch (err) {
      // Two managers saving at the same moment: the partial unique index held the line. Retry once (RD-109).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        created = await write();
      } else {
        throw err;
      }
    }

    await this.audit(
      farmId,
      userId,
      cattleId,
      'Manual nutrition requirement set',
      `Manual requirement set for ${cow.tagNumber}: DM ${dto.dmKg} kg, CP ${dto.cpKg} kg, ME ${dto.meMj} MJ per day.`,
    );

    const resolved = await this.requireResolved(farmId, cattleId);
    return {
      active: this.rowShape(created),
      resolved: resolved.shaped,
      warnings: this.warnings(dto, cow.lastWeightKg),
    };
  }

  async turnOff(farmId: string, userId: string, cattleId: string) {
    const cow = await this.requireCow(farmId, cattleId);
    const closed = await this.prisma.cattleRequirementOverride.updateMany({
      where: { farmId, cattleId, effectiveTo: null },
      data: {
        effectiveTo: new Date(),
        endReason: 'TURNED_OFF',
        endedBy: userId,
      },
    });
    if (closed.count === 0) {
      throw new NotFoundException(
        'Manual requirement is not on for this animal',
      );
    }
    await this.audit(
      farmId,
      userId,
      cattleId,
      'Manual nutrition requirement turned off',
      `Manual requirement turned off for ${cow.tagNumber}; her calculated requirement applies again.`,
    );
    const resolved = await this.requireResolved(farmId, cattleId);
    return { active: null, resolved: resolved.shaped };
  }

  // ---- helpers ------------------------------------------------------------

  private async requireCow(farmId: string, cattleId: string) {
    const cow = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: { id: true, tagNumber: true },
    });
    if (!cow) throw new NotFoundException('Cattle not found');
    return cow;
  }

  private async requireResolved(farmId: string, cattleId: string) {
    const resolved = await this.requirements.resolveOne(farmId, cattleId);
    if (!resolved) throw new NotFoundException('Cattle not found');
    return resolved;
  }

  /** D11 soft checks: saved anyway, returned so the UI can show them. */
  private warnings(
    dto: SetRequirementOverrideDto,
    lastWeightKg: number | null,
  ): OverrideWarning[] {
    const out: OverrideWarning[] = [];
    if (lastWeightKg != null && lastWeightKg > 0) {
      const pct = (dto.dmKg / lastWeightKg) * 100;
      if (pct < 1.5 || pct > 4.5) {
        out.push({
          code: 'dm_body_weight',
          message: `Dry matter is ${pct.toFixed(1)} % of body weight; cows usually eat 1.5–4.5 %.`,
        });
      }
    }
    const cpPct = (dto.cpKg / dto.dmKg) * 100;
    if (cpPct < 8 || cpPct > 22) {
      out.push({
        code: 'cp_share',
        message: `Crude protein is ${cpPct.toFixed(1)} % of dry matter; a diet is usually 8–22 %.`,
      });
    }
    const density = dto.meMj / dto.dmKg;
    if (density < 7 || density > 13) {
      out.push({
        code: 'energy_density',
        message: `Energy is ${density.toFixed(1)} MJ per kg of dry matter; a diet is usually 7–13.`,
      });
    }
    return out;
  }

  private rowShape(r: CattleRequirementOverride) {
    return {
      id: r.id,
      cattle_id: r.cattleId,
      dm_kg: r.dmKg,
      cp_kg: r.cpKg,
      me_mj: r.meMj,
      note: r.note,
      dynamic_snapshot: r.dynamicSnapshot,
      effective_from: r.effectiveFrom,
      effective_to: r.effectiveTo,
      end_reason: r.endReason,
      set_by: r.setBy,
      ended_by: r.endedBy,
    };
  }

  /** An audit-log hiccup must never fail the already-committed change. */
  private async audit(
    farmId: string,
    actorId: string,
    cattleId: string,
    eventTitle: string,
    actionDetails: string,
  ) {
    try {
      await this.activityLog.record({
        farmId,
        module: ActivityLogModule.COW_MANAGEMENT,
        eventTitle,
        actionDetails,
        actorId,
        relatedCattleId: cattleId,
      });
    } catch (err) {
      this.log.error('Manual requirement activity log failed', {
        farmId,
        cattleId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
