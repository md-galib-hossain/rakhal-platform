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
import { validateManualValues } from '../../domain/manual-requirement';
import { FeedRequirementsService } from './feed-requirements.service';

/** A soft (saved-anyway) check. `field` says which input to highlight (MILESTONE 28b, D19). */
export interface OverrideWarning {
  code: string;
  field: string;
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
    const names = await this.userNames([active, last]);
    // D21: the calculated profile in BOTH modes, so the UI can show it read-only, pre-fill from it and put it
    // beside the manual values. For a manual cow it is what the engine says today; otherwise it is the requirement.
    const calculated =
      resolved.shaped.dynamic_requirements ?? resolved.shaped.requirements;
    return {
      active: active ? this.rowShape(active, names) : null,
      resolved: resolved.shaped,
      calculated,
      last: last ? this.rowShape(last, names) : null,
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
    const names = await this.userNames(page.items);
    return { ...page, items: page.items.map((r) => this.rowShape(r, names)) };
  }

  async set(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: SetRequirementOverrideDto,
  ) {
    const cow = await this.prisma.cattle.findFirst({
      where: { id: cattleId, ...activeHerd(farmId) },
      select: { id: true, tagNumber: true, lastWeightKg: true },
    });
    if (!cow) throw new NotFoundException('Cattle not found');

    // Hard rules → 400, soft rules → `warnings[]` on the saved row (D11 + D19, one pure function).
    const { errors, warnings } = validateManualValues(dto, cow.lastWeightKg);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: errors.map((e) => e.message).join(' '),
        errors,
      });
    }

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
            ndfKg: dto.ndfKg ?? null,
            ndfMaxKg: dto.ndfMaxKg ?? null,
            adfKg: dto.adfKg ?? null,
            fatKg: dto.fatKg ?? null,
            tdnKg: dto.tdnKg ?? null,
            calciumKg: dto.calciumKg ?? null,
            phosphorusKg: dto.phosphorusKg ?? null,
            rdpPct: dto.rdpPct ?? null,
            rupPct: dto.rupPct ?? null,
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
    const names = await this.userNames([created]);
    return {
      active: this.rowShape(created, names),
      resolved: resolved.shaped,
      warnings: warnings satisfies OverrideWarning[],
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

  /** Display names for everyone who set or ended these rows — one query. A missing user reads as `null`. */
  private async userNames(
    rows: (CattleRequirementOverride | null)[],
  ): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const r of rows) {
      if (!r) continue;
      ids.add(r.setBy);
      if (r.endedBy) ids.add(r.endedBy);
    }
    if (ids.size === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private rowShape(r: CattleRequirementOverride, names: Map<string, string>) {
    return {
      id: r.id,
      cattle_id: r.cattleId,
      dm_kg: r.dmKg,
      cp_kg: r.cpKg,
      me_mj: r.meMj,
      // MILESTONE 28b: the rest of the profile. `null` on a row saved before v2 (it resolved through the farm shares).
      ndf_kg: r.ndfKg,
      ndf_max_kg: r.ndfMaxKg,
      adf_kg: r.adfKg,
      fat_kg: r.fatKg,
      tdn_kg: r.tdnKg,
      calcium_kg: r.calciumKg,
      phosphorus_kg: r.phosphorusKg,
      rdp_pct: r.rdpPct,
      rup_pct: r.rupPct,
      note: r.note,
      dynamic_snapshot: r.dynamicSnapshot,
      effective_from: r.effectiveFrom,
      effective_to: r.effectiveTo,
      end_reason: r.endReason,
      set_by: r.setBy,
      set_by_name: names.get(r.setBy) ?? null,
      ended_by: r.endedBy,
      ended_by_name: r.endedBy ? (names.get(r.endedBy) ?? null) : null,
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
