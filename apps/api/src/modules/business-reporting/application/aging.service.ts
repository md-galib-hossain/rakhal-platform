import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { toStorage } from 'src/common/money';
import {
  AgingBucketDef,
  buildAgingBucketCaseSql,
  RECEIVABLE_AGING_BUCKETS,
} from '../domain/aging';

export interface AgingBucketResult extends AgingBucketDef {
  amount: string;
  invoiceCount: number;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucketResult[];
  totalOutstanding: string;
  totalCount: number;
}

interface RawBucketRow {
  bucket: string;
  amount: string | null;
  invoiceCount: bigint;
}

/**
 * Receivable/Payable aging (RAKHAL-369, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §6.3, §9.3). Lives in `business-reporting` — a read-only leaf module —
 * rather than `finance-v2/accounts/**` (`balance.service.ts`) because
 * computing payable aging here would require Finance V2 code to read
 * `Payable`/`PaymentAllocation`, a `Finance → Purchasing` edge ADR-022
 * forbids and RAKHAL-353's architecture test fails the build on. This module
 * sits above Sales/Purchasing/Finance V2 instead and is imported by nothing.
 *
 * **Full-population SQL aggregate, never a page of rows reduced in Node**:
 * outstanding is `totalAmount - SUM(PaymentAllocation.amount)`, a value the
 * client cannot compute itself since it never sees individual allocations;
 * bucketing then groups by `daysPastDue = max(0, asOf - dueDate)` (a
 * `dueDate: null` document treated as due `asOf` itself, so it is always
 * `CURRENT` — `domain/aging.ts`'s own doc comment). Both `SUM`/`COUNT` and
 * the bucket assignment happen inside one Postgres query (`GROUP BY`), never
 * by loading every open document into Node and reducing there — see RD-059's
 * updated note on read amplification this milestone's Overview screen
 * otherwise risks.
 *
 * Raw SQL (not `Prisma.groupBy`) is the only way to express this: the bucket
 * key is a computed value (not a stored column) and outstanding requires a
 * `LEFT JOIN` sum against `PaymentAllocation` before the `GROUP BY` can even
 * run — both `farmId`/`asOf` are passed as real query parameters via
 * `Prisma.sql`, never string-concatenated, so this carries no injection risk
 * despite being raw SQL.
 */
@Injectable()
export class AgingService {
  constructor(private readonly prisma: PrismaService) {}

  async getReceivablesAging(farmId: string, asOf: Date): Promise<AgingReport> {
    const rows = await this.queryAging(
      farmId,
      asOf,
      'Receivable',
      'receivableId',
    );
    return this.toReport(asOf, rows);
  }

  async getPayablesAging(farmId: string, asOf: Date): Promise<AgingReport> {
    const rows = await this.queryAging(farmId, asOf, 'Payable', 'payableId');
    return this.toReport(asOf, rows);
  }

  private async queryAging(
    farmId: string,
    asOf: Date,
    table: 'Receivable' | 'Payable',
    allocationFk: 'receivableId' | 'payableId',
  ): Promise<RawBucketRow[]> {
    const bucketCase = buildAgingBucketCaseSql('days_past_due');
    // `table`/`allocationFk` are one of two hardcoded literals selected by
    // this file's own two public methods — never user input — so
    // `Prisma.raw` here carries no injection risk. `farmId`/`asOf` are real
    // bound parameters via the tagged template.
    return this.prisma.$queryRaw<RawBucketRow[]>(Prisma.sql`
      WITH allocation_sums AS (
        SELECT "${Prisma.raw(allocationFk)}" AS doc_id, SUM(amount) AS allocated
        FROM "PaymentAllocation"
        WHERE "${Prisma.raw(allocationFk)}" IS NOT NULL
        GROUP BY "${Prisma.raw(allocationFk)}"
      ),
      open_docs AS (
        SELECT
          d."totalAmount" - COALESCE(a.allocated, 0) AS outstanding,
          GREATEST(0, (${asOf}::date - COALESCE(d."dueDate", ${asOf})::date))::int AS days_past_due
        FROM "${Prisma.raw(table)}" d
        LEFT JOIN allocation_sums a ON a.doc_id = d.id
        WHERE d."farmId" = ${farmId}
      )
      SELECT
        ${Prisma.raw(bucketCase)} AS bucket,
        SUM(outstanding)::text AS amount,
        COUNT(*) AS "invoiceCount"
      FROM open_docs
      WHERE outstanding > 0
      GROUP BY bucket
    `);
  }

  private toReport(asOf: Date, rows: RawBucketRow[]): AgingReport {
    const byKey = new Map(rows.map((r) => [r.bucket, r]));
    let totalOutstanding = toStorage(0);
    let totalCount = 0;

    const buckets: AgingBucketResult[] = RECEIVABLE_AGING_BUCKETS.map((def) => {
      const row = byKey.get(def.key);
      const amount = toStorage(row?.amount ?? 0);
      const invoiceCount = row ? Number(row.invoiceCount) : 0;
      totalOutstanding = totalOutstanding.plus(amount);
      totalCount += invoiceCount;
      return { ...def, amount: amount.toString(), invoiceCount };
    });

    return {
      asOf: asOf.toISOString(),
      buckets,
      totalOutstanding: totalOutstanding.toString(),
      totalCount,
    };
  }
}
