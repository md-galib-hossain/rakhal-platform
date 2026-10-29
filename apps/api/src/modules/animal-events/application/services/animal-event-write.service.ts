import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { txStore } from 'src/core/database/prisma/tx-context';
import { categoriesOf } from '../../domain/eligibility/categories';
import { evaluateEligibility } from '../../domain/eligibility/evaluate';
import { EventRegistry } from '../../domain/event-registry';
import { buildFindings, EventFinding } from '../../domain/findings';
import { RecordEventDto } from '../../presentation/dto/record-event.dto';
import { runInEventApi } from '../event-api-context';
import { EventHandlerRegistry } from '../event-handler';
import { eventError } from '../parse-payload';
import { EVENT_REGISTRY } from './animal-event-types.service';
import { EligibilityService } from './eligibility.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Events older than this default to HISTORICAL (hub §6). */
const HISTORICAL_AFTER_DAYS = 7;
/** Types that have no domain service: the header row IS the event (04 §2). */
const GENERIC_TYPES = new Set(['ENTER_FATTENING', 'LEAVE_FATTENING', 'NOTE']);

export interface RecordEventOptions {
  dryRun?: boolean;
  idempotencyKey?: string;
}

/**
 * `POST /cattle/:id/events` (RAKHAL-481): validate, evaluate findings, then
 * run header insert + domain handler in ONE interactive transaction. Existing
 * services join that transaction through `txStore` (see `PrismaService`), and
 * the `animal_event_sync` trigger adopts the pre-inserted header instead of
 * creating its own. A failure anywhere rolls back header and detail together.
 * Block only what is impossible (422 + code); warn on the rest (hub §3.4).
 */
@Injectable()
export class AnimalEventWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: EligibilityService,
    private readonly handlers: EventHandlerRegistry,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  async record(
    farmId: string,
    userId: string,
    cattleId: string,
    dto: RecordEventDto,
    opts: RecordEventOptions = {},
  ) {
    const def = this.registry.get(dto.type);
    if (!def) {
      throw eventError('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
    }
    const handler = this.handlers.get(dto.type);
    if (!handler && !GENERIC_TYPES.has(dto.type)) {
      throw eventError(
        'EVENT_TYPE_NOT_SUPPORTED',
        `Event type ${dto.type} cannot be recorded through this API yet`,
      );
    }

    const eventAt = new Date(dto.eventAt);
    const now = new Date();
    const provenance =
      dto.provenance ??
      (now.getTime() - eventAt.getTime() > HISTORICAL_AFTER_DAYS * DAY_MS
        ? 'HISTORICAL'
        : 'RECORDED');
    if (provenance === 'HISTORICAL' && !def.allowsHistorical) {
      throw eventError(
        'EVENT_HISTORICAL_NOT_ALLOWED',
        `${dto.type} cannot be recorded as a history entry`,
      );
    }

    const { facts, ctx, leftHerd } = await this.eligibility.loadFacts(
      farmId,
      cattleId,
      now,
    );
    const result = evaluateEligibility(def, {
      facts,
      ctx,
      date: eventAt,
      leftHerd,
    });
    const payload = dto.payload ?? {};
    const hasPendingBreeding =
      (await this.prisma.breedingEvent.count({
        where: { cattleId, status: 'PENDING_CHECK', voidedAt: null },
      })) > 0;
    const findings = buildFindings(def, result, {
      categories: categoriesOf(facts, ctx),
      hasPendingBreeding,
      breedingGiven: Boolean(payload.breedingEventId),
    });
    // Handler-specific warnings (e.g. health: OPEN_CASE_EXISTS).
    const extra = handler?.findingsFor
      ? await handler.findingsFor(dto.type, { cattleId, payload })
      : [];
    for (const code of extra) {
      if (!findings.some((f) => f.code === code))
        findings.push({ code, severity: 'WARN' });
    }
    const followUpsPreview = def.followUps.map((ruleKey) => ({ ruleKey }));
    const blocks = findings.filter((f) => f.severity === 'BLOCK');

    if (opts.dryRun) {
      return {
        dryRun: true as const,
        type: dto.type,
        eventAt,
        provenance,
        blocked: blocks.length > 0,
        findings,
        followUpsPreview,
      };
    }
    if (blocks.length) {
      throw eventError(
        blocks[0].code,
        `${dto.type} cannot be recorded for this animal`,
        { findings },
      );
    }

    return this.withIdempotency(
      farmId,
      opts.idempotencyKey,
      `animal-events.record:${cattleId}`,
      async () => {
        const warnings = findings.filter((f) => f.severity === 'WARN');
        const c: Common = {
          farmId,
          userId,
          cattleId,
          eventAt,
          provenance,
          payload,
          warnings,
        };
        const { eventId, detail } = await this.save(handler, dto, c);
        const event = await this.prisma.animalEvent.findUniqueOrThrow({
          where: { id: eventId },
        });
        return JSON.parse(
          JSON.stringify({
            dryRun: false,
            event,
            detail,
            findings,
            followUpsPreview,
          }),
        ) as Record<string, unknown>;
      },
    );
  }

  /** Header + detail in one transaction; any error rolls both back. */
  private async save(
    handler: ReturnType<EventHandlerRegistry['get']>,
    dto: RecordEventDto,
    c: Common,
  ): Promise<{ eventId: string; detail: unknown }> {
    const generic = this.genericData(dto, c);
    const eventId = `ae_${randomUUID().replace(/-/g, '')}`;
    return this.prisma.$transaction(
      async (tx) =>
        txStore.run({ tx }, async () => {
          await tx.animalEvent.create({
            data: {
              id: eventId,
              farmId: c.farmId,
              cattleId: c.cattleId,
              type: dto.type,
              eventAt: c.eventAt,
              ...(generic ? { data: generic } : {}),
              ...this.meta(dto, c),
            },
          });
          if (!handler) return { eventId, detail: null };

          // Announce the header so the detail-table trigger adopts it.
          await tx.$queryRaw`SELECT set_config('app.event_id', ${eventId}, true), set_config('app.event_type', ${dto.type}, true)`;
          const res = await runInEventApi(
            { historical: c.provenance === 'HISTORICAL' },
            () =>
              handler.handle(dto.type, {
                farmId: c.farmId,
                userId: c.userId,
                cattleId: c.cattleId,
                eventAt: c.eventAt,
                notes: dto.notes,
                provenance: c.provenance,
                payload: c.payload,
              }),
          );
          if (res.headerData) {
            await tx.animalEvent.update({
              where: { id: eventId },
              data: { data: res.headerData as Prisma.InputJsonValue },
            });
          }
          return { eventId, detail: res.detail };
        }),
      { timeout: 30_000, maxWait: 10_000 },
    );
  }

  /** `data` for header-only types (note text, fattening details), validated. */
  private genericData(
    dto: RecordEventDto,
    c: Common,
  ): Prisma.InputJsonValue | null {
    if (!GENERIC_TYPES.has(dto.type)) return null;
    let data: Prisma.InputJsonValue;
    if (dto.type === 'NOTE') {
      const text =
        typeof c.payload.text === 'string' ? c.payload.text.trim() : '';
      if (!text) {
        throw eventError('EVENT_PAYLOAD_INVALID', 'A note needs payload.text');
      }
      data = { text };
    } else {
      data = c.payload as Prisma.InputJsonValue;
    }
    if (JSON.stringify(data).length > 4096) {
      throw eventError('EVENT_PAYLOAD_INVALID', 'Event payload exceeds 4 KB');
    }
    return data;
  }

  private meta(dto: RecordEventDto, c: Common) {
    return {
      provenance: c.provenance,
      notes: dto.notes ?? null,
      sourceEventId: dto.sourceEventId ?? null,
      recordedById: c.userId,
      findings: c.warnings.length
        ? (c.warnings as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };
  }

  /** Same replay contract as the legacy reproduction routes. */
  private async withIdempotency<T>(
    farmId: string,
    key: string | undefined,
    endpoint: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) return fn();
    try {
      await this.prisma.idempotencyKey.create({
        data: { farmId, key, endpoint },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { farmId_key_endpoint: { farmId, key, endpoint } },
      });
      if (existing?.responseBody) return existing.responseBody as T;
      throw new ConflictException(
        'An identical request with this Idempotency-Key is already in progress',
      );
    }
    try {
      const result = await fn();
      await this.prisma.idempotencyKey.update({
        where: { farmId_key_endpoint: { farmId, key, endpoint } },
        data: { responseBody: result as unknown as Prisma.InputJsonValue },
      });
      return result;
    } catch (e) {
      // A failed save must not leave the key stuck "in progress".
      await this.prisma.idempotencyKey
        .delete({ where: { farmId_key_endpoint: { farmId, key, endpoint } } })
        .catch(() => undefined);
      throw e;
    }
  }
}

interface Common {
  farmId: string;
  userId: string;
  cattleId: string;
  eventAt: Date;
  provenance: 'RECORDED' | 'HISTORICAL';
  payload: Record<string, unknown>;
  warnings: EventFinding[];
}
