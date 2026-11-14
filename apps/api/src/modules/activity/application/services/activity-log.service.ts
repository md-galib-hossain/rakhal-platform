import { Injectable } from '@nestjs/common';
import { ActivityLog, ActivityLogModule, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { sha256Hex } from 'src/common/crypto';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { ListActivityQueryDto } from '../../presentation/dto/list-activity-query.dto';

export interface ActivityTaggedValue {
  key: string;
  value: string;
}

export interface RecordActivityInput {
  farmId: string;
  module: ActivityLogModule;
  eventTitle: string;
  actionDetails: string;
  actorId?: string | null;
  relatedCattleId?: string | null;
  aqrImpact?: number | null;
  financialImpact?: number | null;
  previousAqrScore?: number | null;
  taggedValues?: ActivityTaggedValue[] | null;
}

const MODULE_LABELS: Record<ActivityLogModule, string> = {
  COW_MANAGEMENT: 'Cow Management',
  MILK_PRODUCTION: 'Milk Production',
  HEALTH_SAFETY: 'Health & Safety',
  FINANCE: 'Finance',
  BREEDING: 'Breeding',
  INVENTORY: 'Inventory',
  GENERAL: 'General',
};

/**
 * Append-only, hash-chained Activity Log (PRD §19). The only write path is
 * {@link record} — there is intentionally **no update or delete** (§19.3). Each
 * entry's `hash = sha256(canonical(fields) + prevHash)`, chaining entries per
 * farm so any tampering with history is detectable ({@link verifyChain}).
 *
 * Other modules inject this service and call `record(...)` for their events
 * (the AQR engine, milk submit, finance transactions, etc.).
 */
@Injectable()
export class ActivityLogService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ActivityLogService.name);
  }

  /** Append an immutable entry, chained to the farm's previous entry hash. */
  async record(input: RecordActivityInput): Promise<ActivityLog> {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.activityLog.findFirst({
        where: { farmId: input.farmId },
        orderBy: { createdAt: 'desc' },
        select: { hash: true },
      });
      const prevHash = last?.hash ?? null;
      const timestamp = new Date();
      const taggedValues = input.taggedValues ?? null;
      const hash = this.computeHash(input, timestamp, taggedValues, prevHash);

      return tx.activityLog.create({
        data: {
          farmId: input.farmId,
          timestamp,
          module: input.module,
          eventTitle: input.eventTitle,
          actionDetails: input.actionDetails,
          ...(taggedValues
            ? { taggedValues: taggedValues as unknown as Prisma.InputJsonValue }
            : {}),
          aqrImpact: input.aqrImpact ?? null,
          financialImpact: input.financialImpact ?? null,
          previousAqrScore: input.previousAqrScore ?? null,
          actorId: input.actorId ?? null,
          relatedCattleId: input.relatedCattleId ?? null,
          prevHash,
          hash,
        },
      });
    });
  }

  async list(
    farmId: string,
    query: ListActivityQueryDto,
  ): Promise<CursorPage<unknown>> {
    const where: Prisma.ActivityLogWhereInput = {
      farmId,
      ...(query.module ? { module: query.module } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.aqrImpactOnly ? { aqrImpact: { not: null } } : {}),
      ...(query.financialImpactOnly ? { financialImpact: { not: null } } : {}),
      ...(query.from || query.to
        ? {
            timestamp: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.activityLog.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
      include: { actor: { select: { id: true, name: true } } },
    });

    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((row) => this.present(row)),
      meta: page.meta,
    };
  }

  /**
   * Recompute the hash chain for a farm and report the first broken link, if any.
   * Useful for audit/integrity checks (the log is tamper-evident, not just
   * tamper-resistant).
   */
  async verifyChain(
    farmId: string,
  ): Promise<{ valid: boolean; entries: number; brokenAt: string | null }> {
    const rows = await this.prisma.activityLog.findMany({
      where: { farmId },
      orderBy: { createdAt: 'asc' },
    });

    let prevHash: string | null = null;
    for (const row of rows) {
      const expected = this.computeHash(
        {
          farmId: row.farmId,
          module: row.module,
          eventTitle: row.eventTitle,
          actionDetails: row.actionDetails,
          aqrImpact: row.aqrImpact,
          financialImpact: row.financialImpact,
          actorId: row.actorId,
          relatedCattleId: row.relatedCattleId,
        },
        row.timestamp,
        (row.taggedValues as unknown as ActivityTaggedValue[] | null) ?? null,
        prevHash,
      );
      if (row.prevHash !== prevHash || row.hash !== expected) {
        return { valid: false, entries: rows.length, brokenAt: row.id };
      }
      prevHash = row.hash;
    }

    return { valid: true, entries: rows.length, brokenAt: null };
  }

  private computeHash(
    input: Omit<RecordActivityInput, 'taggedValues'>,
    timestamp: Date,
    taggedValues: ActivityTaggedValue[] | null,
    prevHash: string | null,
  ): string {
    return sha256Hex(
      JSON.stringify({
        farmId: input.farmId,
        timestamp: timestamp.toISOString(),
        module: input.module,
        eventTitle: input.eventTitle,
        actionDetails: input.actionDetails,
        taggedValues,
        aqrImpact: input.aqrImpact ?? null,
        financialImpact: input.financialImpact ?? null,
        actorId: input.actorId ?? null,
        relatedCattleId: input.relatedCattleId ?? null,
        prevHash,
      }),
    );
  }

  private present(
    row: ActivityLog & { actor: { id: string; name: string } | null },
  ) {
    return {
      ...row,
      moduleLabel: MODULE_LABELS[row.module],
      dateGroup: row.timestamp.toISOString().slice(0, 10),
      actor: row.actor ?? { id: null, name: 'System' },
      actorType: row.actorId ? 'user' : 'system',
    };
  }
}
