import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EventRegistry } from '../../domain/event-registry';
import { ListCattleEventsDto } from '../../presentation/dto/list-cattle-events.dto';
import { EVENT_REGISTRY } from './animal-event-types.service';

interface Cursor {
  at: string;
  type: string;
  id: string;
}

const encode = (c: Cursor) =>
  Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
function decode(raw: string): Cursor | null {
  try {
    const c = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Cursor;
    return c.at && c.type && c.id && !Number.isNaN(Date.parse(c.at)) ? c : null;
  } catch {
    return null;
  }
}

/**
 * Unified per-animal timeline (RAKHAL-479): one indexed query on `AnimalEvent`
 * `(farmId, cattleId, eventAt, id)` plus a batched join to each type's detail
 * table by `animalEventId`. Order: `eventAt desc, type desc, id desc`; the
 * cursor carries the same triple, so same-day rows page without gaps or
 * repeats.
 */
@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  async list(farmId: string, cattleId: string, query: ListCattleEventsDto) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: { id: true },
    });
    if (!cattle) throw new NotFoundException('Animal not found');

    const limit = query.limit ?? 30;
    const conds: Prisma.Sql[] = [
      Prisma.sql`"farmId" = ${farmId}`,
      Prisma.sql`"cattleId" = ${cattleId}`,
    ];
    if (!query.includeVoided) conds.push(Prisma.sql`status = 'ACTIVE'`);
    if (query.group) {
      const types = this.registry
        .all()
        .filter((d) => d.group === query.group)
        .map((d) => d.type);
      if (!types.length) return this.page([], limit);
      conds.push(Prisma.sql`type::text IN (${Prisma.join(types)})`);
    }
    const cursor = query.cursor ? decode(query.cursor) : null;
    if (cursor) {
      const at = new Date(cursor.at);
      conds.push(
        Prisma.sql`("eventAt" < ${at} OR ("eventAt" = ${at} AND (type::text < ${cursor.type} OR (type::text = ${cursor.type} AND id < ${cursor.id}))))`,
      );
    }

    const ids = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "AnimalEvent" WHERE ${Prisma.join(conds, ' AND ')}
                 ORDER BY "eventAt" DESC, type::text DESC, id DESC LIMIT ${limit + 1}`,
    );
    const events = await this.prisma.animalEvent.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
    });
    const order = new Map(ids.map((r, i) => [r.id, i]));
    events.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

    const details = await this.loadDetails(events.map((e) => e.id));
    const rows = events.map((e) => ({
      ...e,
      detail: details.get(e.id) ?? null,
    }));
    return this.page(rows, limit);
  }

  private page<T extends { id: string; eventAt?: Date; type?: string }>(
    rows: T[],
    limit: number,
  ) {
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      meta: {
        count: items.length,
        limit,
        hasNextPage,
        endCursor:
          hasNextPage && last?.eventAt && last.type
            ? encode({
                at: last.eventAt.toISOString(),
                type: last.type,
                id: last.id,
              })
            : null,
      },
    };
  }

  /** Detail rows for a page of headers, keyed by `animalEventId`. */
  private async loadDetails(eventIds: string[]) {
    const where = { animalEventId: { in: eventIds } };
    const p = this.prisma;
    const lists: Array<Array<{ animalEventId: string | null }>> =
      await Promise.all([
        p.heatEvent.findMany({ where }),
        p.breedingEvent.findMany({ where }),
        p.pregnancyDiagnosis.findMany({ where }),
        p.calvingEvent.findMany({ where }),
        p.abortionEvent.findMany({ where }),
        p.dryPeriod.findMany({ where }),
        p.weightRecord.findMany({ where }),
        p.calfWeightRecord.findMany({ where }),
        p.bodyConditionScore.findMany({ where }),
        p.treatmentLog.findMany({ where }),
        p.cattleDisposition.findMany({ where }),
        p.mortalityRecord.findMany({ where }),
        p.calfWeaningRecord.findMany({ where }),
      ]);
    const out = new Map<string, unknown>();
    for (const list of lists) {
      for (const row of list)
        if (row.animalEventId) out.set(row.animalEventId, row);
    }
    return out;
  }
}
