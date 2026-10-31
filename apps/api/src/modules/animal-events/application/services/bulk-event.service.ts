import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ActivityLogModule } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { txStore } from 'src/core/database/prisma/tx-context';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { EventRegistry } from '../../domain/event-registry';
import type { EventFinding } from '../../domain/findings';
import { BulkEventDto } from '../../presentation/dto/bulk-event.dto';
import { RecordEventDto } from '../../presentation/dto/record-event.dto';
import { eventError } from '../parse-payload';
import { EVENT_REGISTRY } from './animal-event-types.service';
import { AnimalEventWriteService } from './animal-event-write.service';

/** Types whose payload differs per animal: a value for each one comes in `values`. */
const PER_ANIMAL_TYPES = new Set(['WEIGHT', 'BCS', 'PREG_CHECK']);

export type BulkRowStatus = 'CREATED' | 'ELIGIBLE' | 'SKIPPED' | 'BLOCKED';

export interface BulkRow {
  cattleId: string;
  tagNumber: string;
  status: BulkRowStatus;
  eventId?: string;
  /** Why an animal was skipped (a BLOCK finding code, or `VALUES_MISSING`). */
  reason?: string;
  findings: EventFinding[];
}

/**
 * `POST /animal-events/bulk` (RAKHAL-489, hub §3.9): one event type for up to 100 animals.
 * Every animal goes through the single-event write path (RAKHAL-481), so eligibility, handlers,
 * follow-ups and finance behave exactly as when saved one by one. The save is ONE transaction:
 * the animals' rows are locked in sorted id order (no deadlocks between two bulk saves), one
 * `AnimalEventBatch` row ties the headers together, and any failure rolls everything back.
 * Eligibility is checked first (read-only), so a blocked animal is reported as skipped with its
 * reason (`skipIneligible`) or fails the whole request before anything is written (`allOrNothing`).
 */
@Injectable()
export class BulkEventService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AnimalEventWriteService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationService,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BulkEventService.name);
  }

  async bulk(
    farmId: string,
    userId: string,
    dto: BulkEventDto,
    opts: { dryRun?: boolean } = {},
  ) {
    if (!this.registry.get(dto.type)) {
      throw eventError('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
    }
    const mode = dto.mode ?? 'skipIneligible';
    const requested = [...dto.cattleIds];
    const ids = [...new Set(requested)].sort();

    if (dto.values) {
      if (!PER_ANIMAL_TYPES.has(dto.type)) {
        throw eventError(
          'BULK_VALUES_NOT_SUPPORTED',
          `Per-animal values are only for ${[...PER_ANIMAL_TYPES].join(', ')}`,
        );
      }
      const stray = Object.keys(dto.values).filter((k) => !ids.includes(k));
      if (stray.length) {
        throw new BadRequestException(
          `values has entries for animals not in cattleIds: ${stray.join(', ')}`,
        );
      }
    }

    // An unknown or other-farm id is a 404 and nothing is written.
    const cows = await this.prisma.cattle.findMany({
      where: { id: { in: ids }, farmId },
      select: { id: true, tagNumber: true },
    });
    if (cows.length !== ids.length) {
      const have = new Set(cows.map((c) => c.id));
      throw new NotFoundException({
        message: 'One or more animals were not found',
        details: { missing: ids.filter((i) => !have.has(i)) },
      });
    }
    const tagOf = new Map(cows.map((c) => [c.id, c.tagNumber]));

    const recordDto = (id: string): RecordEventDto => ({
      type: dto.type,
      eventAt: dto.eventAt,
      provenance: dto.provenance,
      notes: dto.notes,
      customTypeId: dto.customTypeId,
      followUps: dto.followUps,
      payload: { ...(dto.payload ?? {}), ...(dto.values?.[id] ?? {}) },
    });

    // Phase 1 (read-only): who can take it.
    const rows = new Map<string, BulkRow>();
    const eligible: string[] = [];
    for (const id of ids) {
      const base = { cattleId: id, tagNumber: tagOf.get(id)! };
      if (
        PER_ANIMAL_TYPES.has(dto.type) &&
        Object.keys(recordDto(id).payload ?? {}).length === 0
      ) {
        rows.set(id, {
          ...base,
          status: 'SKIPPED',
          reason: 'VALUES_MISSING',
          findings: [],
        });
        continue;
      }
      const dry = (await this.writer.record(farmId, userId, id, recordDto(id), {
        dryRun: true,
      })) as unknown as { blocked: boolean; findings: EventFinding[] };
      if (dry.blocked) {
        rows.set(id, {
          ...base,
          status: mode === 'allOrNothing' ? 'BLOCKED' : 'SKIPPED',
          reason: dry.findings.find((f) => f.severity === 'BLOCK')?.code,
          findings: dry.findings,
        });
      } else {
        rows.set(id, { ...base, status: 'ELIGIBLE', findings: dry.findings });
        eligible.push(id);
      }
    }
    const ordered = () => requested.map((id) => rows.get(id)!);
    const skippedRows = () =>
      [...rows.values()].filter(
        (r) => r.status === 'SKIPPED' || r.status === 'BLOCKED',
      );

    if (mode === 'allOrNothing' && skippedRows().length) {
      throw eventError(
        'BULK_BLOCKED',
        `${skippedRows().length} animal(s) cannot take ${dto.type}; nothing was saved`,
        { results: ordered() },
      );
    }
    const eventAt = new Date(dto.eventAt);
    if (opts.dryRun || eligible.length === 0) {
      return {
        dryRun: Boolean(opts.dryRun),
        batchId: null,
        type: dto.type,
        eventAt,
        mode,
        requested: ids.length,
        saved: 0,
        skipped: skippedRows().length,
        results: ordered(),
      };
    }

    // Phase 2: one transaction, sorted locks, one batch row.
    const batchId = await this.prisma.$transaction(
      async (tx) =>
        txStore.run({ tx }, async () => {
          await tx.$queryRaw`SELECT id FROM "Cattle" WHERE id = ANY(${eligible}::text[]) ORDER BY id FOR UPDATE`;
          const batch = await tx.animalEventBatch.create({
            data: {
              farmId,
              type: dto.type,
              eventAt,
              category: dto.category ?? null,
              notes: dto.notes ?? null,
              requested: ids.length,
              saved: 0,
              recordedById: userId,
            },
          });
          let saved = 0;
          for (const id of eligible) {
            try {
              const res = (await this.writer.record(
                farmId,
                userId,
                id,
                recordDto(id),
                { batchId: batch.id },
              )) as { event: { id: string }; findings: EventFinding[] };
              rows.set(id, {
                ...rows.get(id)!,
                status: 'CREATED',
                eventId: res.event.id,
                findings: res.findings,
              });
              saved++;
            } catch (e) {
              // Became blocked after the lock (state changed since phase 1): thrown before any write for this animal.
              const blocked = this.blockFindings(e);
              if (mode !== 'skipIneligible' || !blocked) throw e;
              rows.set(id, {
                ...rows.get(id)!,
                status: 'SKIPPED',
                reason: blocked.find((f) => f.severity === 'BLOCK')?.code,
                findings: blocked,
              });
            }
          }
          await tx.animalEventBatch.update({
            where: { id: batch.id },
            data: {
              saved,
              skipped: skippedRows().map((r) => ({
                cattleId: r.cattleId,
                reason: r.reason ?? null,
              })),
            },
          });
          return batch.id;
        }),
      { timeout: 120_000, maxWait: 10_000 },
    );

    const results = ordered();
    const saved = results.filter((r) => r.status === 'CREATED').length;
    await this.afterCommit(farmId, userId, dto, batchId, saved, ids.length);
    return {
      dryRun: false,
      batchId,
      type: dto.type,
      eventAt,
      mode,
      requested: ids.length,
      saved,
      skipped: results.length - saved,
      results,
    };
  }

  /** The findings of a "cannot be recorded" 422 from the single-event path, else null. */
  private blockFindings(e: unknown): EventFinding[] | null {
    if (!(e instanceof UnprocessableEntityException)) return null;
    const body = e.getResponse() as {
      details?: { findings?: EventFinding[] };
    };
    const all = body.details?.findings;
    return all?.some((f) => f.severity === 'BLOCK') ? all : null;
  }

  /** One Activity Log line and one grouped notification for the whole batch (best effort). */
  private async afterCommit(
    farmId: string,
    userId: string,
    dto: BulkEventDto,
    batchId: string,
    saved: number,
    requested: number,
  ) {
    try {
      await this.activity.record({
        farmId,
        module: ActivityLogModule.COW_MANAGEMENT,
        eventTitle: 'Bulk animal event',
        actionDetails: `${dto.type} recorded for ${saved} of ${requested} animals.`,
        actorId: userId,
        taggedValues: [{ key: 'batchId', value: batchId }],
      });
      if (saved === 0) return;
      const members = await this.prisma.farmMember.findMany({
        where: {
          farmId,
          userId: { not: userId },
          role: { name: { in: ['Owner', 'Manager'] } },
        },
        select: { userId: true },
      });
      await this.notifications.notifyUsers({
        farmId,
        userIds: members.map((m) => m.userId),
        eventKey: 'bulk_event_recorded',
        title: 'Bulk event recorded',
        message: `${dto.type}: ${saved} of ${requested} animals recorded.`,
        params: { type: dto.type, saved, requested },
        link: '/cattle',
        dedupeKey: `bulk_event_recorded:${batchId}`,
      });
    } catch (err) {
      this.log.error('Bulk event follow-through failed', {
        batchId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
