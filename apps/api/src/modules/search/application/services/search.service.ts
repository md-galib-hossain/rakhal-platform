import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

/** A normalized search result across every entity type. */
export interface SearchHit {
  id: string;
  label: string;
  sublabel: string | null;
  score: number;
  link: string;
}

interface RawHit {
  id: string;
  label: string | null;
  sublabel: string | null;
  score: number;
}

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 5;

/**
 * Global cross-entity search (RAKHAL-257). Farm-scoped, fuzzy/typo-tolerant via
 * Postgres `pg_trgm` (`similarity()` + the `%` operator) combined with an `ILIKE`
 * substring fallback. All queries are parameterized (`Prisma.sql`) — the query
 * text and farmId are bound values, never interpolated. At farm scale the
 * per-farm row counts are tiny, so no dedicated indexes are needed yet.
 */
@Injectable()
export class SearchService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SearchService.name);
  }

  async search(farmId: string, rawQuery: string, limit = DEFAULT_LIMIT) {
    const q = rawQuery.trim();
    const results = {
      cattle: [] as SearchHit[],
      tasks: [] as SearchHit[],
      suppliers: [] as SearchHit[],
      buyers: [] as SearchHit[],
      sheds: [] as SearchHit[],
      medicines: [] as SearchHit[],
    };
    if (q.length < MIN_QUERY_LENGTH) {
      return { query: q, results, total: 0 };
    }
    const take = Math.min(Math.max(limit, 1), 20);

    const [cattle, tasks, suppliers, buyers, sheds, medicines] =
      await Promise.all([
        this.searchCattle(farmId, q, take),
        this.searchTasks(farmId, q, take),
        this.searchSuppliers(farmId, q, take),
        this.searchBuyers(farmId, q, take),
        this.searchSheds(farmId, q, take),
        this.searchMedicines(farmId, q, take),
      ]);

    results.cattle = cattle;
    results.tasks = tasks;
    results.suppliers = suppliers;
    results.buyers = buyers;
    results.sheds = sheds;
    results.medicines = medicines;

    const total =
      cattle.length +
      tasks.length +
      suppliers.length +
      buyers.length +
      sheds.length +
      medicines.length;
    return { query: q, results, total };
  }

  // ---- per-entity trigram queries -----------------------------------------

  private async searchCattle(farmId: string, q: string, take: number) {
    const like = `%${q}%`;
    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT id,
             coalesce(name, "tagNumber") AS label,
             "tagNumber" AS sublabel,
             GREATEST(similarity(coalesce(name, ''), ${q}), similarity("tagNumber", ${q})) AS score
      FROM "Cattle"
      WHERE "farmId" = ${farmId} AND "isActive" = true
        AND (coalesce(name, '') % ${q} OR "tagNumber" % ${q}
             OR name ILIKE ${like} OR "tagNumber" ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
    return this.toHits(rows, (id) => `/cattle/${id}`);
  }

  private async searchTasks(farmId: string, q: string, take: number) {
    const like = `%${q}%`;
    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT id, name AS label, reference AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(reference, ${q})) AS score
      FROM "Task"
      WHERE "farmId" = ${farmId}
        AND (name % ${q} OR reference % ${q}
             OR name ILIKE ${like} OR reference ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
    return this.toHits(rows, (id) => `/tasks/${id}`);
  }

  private async searchSuppliers(farmId: string, q: string, take: number) {
    const like = `%${q}%`;
    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT id, name AS label, phone AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(coalesce(phone, ''), ${q})) AS score
      FROM "Supplier"
      WHERE "farmId" = ${farmId} AND "isActive" = true
        AND (name % ${q} OR name ILIKE ${like} OR coalesce(phone, '') ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
    return this.toHits(rows, (id) => `/settings/suppliers/${id}`);
  }

  private async searchBuyers(farmId: string, q: string, take: number) {
    const like = `%${q}%`;
    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT id, name AS label, phone AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(coalesce(phone, ''), ${q})) AS score
      FROM "MilkBuyer"
      WHERE "farmId" = ${farmId} AND "isActive" = true
        AND (name % ${q} OR name ILIKE ${like} OR coalesce(phone, '') ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
    return this.toHits(rows, (id) => `/milk/buyers/${id}`);
  }

  private async searchSheds(farmId: string, q: string, take: number) {
    const like = `%${q}%`;
    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT id, name AS label, code AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(code, ${q})) AS score
      FROM "Shed"
      WHERE "farmId" = ${farmId} AND "isActive" = true
        AND (name % ${q} OR code % ${q}
             OR name ILIKE ${like} OR code ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
    return this.toHits(rows, (id) => `/settings/sheds/${id}`);
  }

  private async searchMedicines(farmId: string, q: string, take: number) {
    const like = `%${q}%`;
    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT id, name AS label, manufacturer AS sublabel,
             GREATEST(similarity(name, ${q}), similarity(coalesce(manufacturer, ''), ${q})) AS score
      FROM "Medicine"
      WHERE "farmId" = ${farmId} AND "isActive" = true
        AND (name % ${q} OR name ILIKE ${like} OR coalesce(manufacturer, '') ILIKE ${like})
      ORDER BY score DESC, label ASC
      LIMIT ${take}
    `);
    return this.toHits(rows, (id) => `/inventory/medicine/${id}`);
  }

  private toHits(rows: RawHit[], link: (id: string) => string): SearchHit[] {
    return rows.map((r) => ({
      id: r.id,
      label: r.label ?? '',
      sublabel: r.sublabel,
      score: Number(r.score),
      link: link(r.id),
    }));
  }
}
