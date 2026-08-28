import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook, type CellValue } from 'exceljs';
import { MilkSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CacheService } from 'src/core/cache/cache.service';
import { MilkService } from './milk.service';
import { activeHerd } from 'src/modules/cattle/domain/herd-scope';
import { ImportMilkConfirmDto } from '../../presentation/dto/import-milk.dto';

/** One cow's session yields for one day, as read from a wide-format row. */
interface ImportRowData {
  date: string; // ISO date
  cattleId: string;
  tankId: string | null;
  sessions: Partial<Record<MilkSession, number>>;
}

interface PreviewRow {
  row: number;
  date: string | null;
  tag: string | null;
  status: 'ready' | 'error';
  error?: string;
  data?: ImportRowData;
}

interface ImportSession {
  rows: PreviewRow[];
}

interface ImportEntry {
  cattleId: string;
  yieldL: number;
  tankId?: string;
}

const SESSION_TTL_SECONDS = 30 * 60;
const SESSION_COLUMNS: Record<string, MilkSession> = {
  morning: MilkSession.MORNING,
  noon: MilkSession.NOON,
  evening: MilkSession.EVENING,
  night: MilkSession.NIGHT,
};

/**
 * Milk log Excel import — wide template (1 row per cow+date): `Date, Cow Tag,
 * Morning, Noon, Evening, Night, Tank`. Two-step preview → confirm, same shape
 * as `CattleImportService`: preview parses + validates every row and caches it
 * under a session id, confirm replays the ready rows through `MilkService
 * .saveLog` (one call per date+session group) so an imported row that lands on
 * an already-submitted entry gets the exact same tank reconciliation a manual
 * edit would (see `saveLog`'s submitted-entry reconciliation).
 */
@Injectable()
export class MilkImportService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly milkService: MilkService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MilkImportService.name);
  }

  async preview(farmId: string, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('An Excel (.xlsx) file is required');
    }

    const records = await this.parseWorkbook(file.buffer);
    if (records.length === 0) {
      throw new BadRequestException('Excel file has no data rows');
    }

    const [cattle, tanks] = await Promise.all([
      this.prisma.cattle.findMany({
        where: activeHerd(farmId),
        select: { id: true, tagNumber: true },
      }),
      this.prisma.milkTank.findMany({
        where: { farmId, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    const cattleByTag = new Map(
      cattle.map((c) => [c.tagNumber.toLowerCase(), c.id]),
    );
    const tankByName = new Map(tanks.map((t) => [t.name.toLowerCase(), t.id]));

    const rows = records.map((record, index) =>
      this.validateRow(record, index + 1, { cattleByTag, tankByName }),
    );

    const importSessionId = randomUUID();
    await this.cache.set<ImportSession>(
      this.sessionKey(farmId, importSessionId),
      { rows },
      SESSION_TTL_SECONDS,
    );

    const errorCount = rows.filter((r) => r.status === 'error').length;
    this.log.info('Milk import previewed', {
      farmId,
      total: rows.length,
      errors: errorCount,
    });

    return {
      importSessionId,
      total: rows.length,
      ready: rows.length - errorCount,
      errors: errorCount,
      rows: rows.map((r) => ({
        row: r.row,
        date: r.date,
        tag: r.tag,
        status: r.status,
        error: r.error,
      })),
    };
  }

  async confirm(farmId: string, userId: string, dto: ImportMilkConfirmDto) {
    const session = await this.cache.get<ImportSession>(
      this.sessionKey(farmId, dto.importSessionId),
    );
    if (!session) {
      throw new BadRequestException('Import session expired or not found');
    }

    const errorRows = session.rows.filter((r) => r.status === 'error');
    if (errorRows.length > 0 && !dto.skipErrors) {
      throw new BadRequestException(
        `Import has ${errorRows.length} invalid row(s); resolve them or set skipErrors`,
      );
    }

    const ready = session.rows.filter(
      (r): r is PreviewRow & { data: ImportRowData } =>
        r.status === 'ready' && Boolean(r.data),
    );

    // Explode wide rows (one per cow+date, up to 4 sessions each) into the
    // long (date, session) groups `saveLog` expects, then replay each group
    // through the real save path — reconciliation for an already-submitted
    // entry included, for free.
    const groups = new Map<
      string,
      { date: string; session: MilkSession; entries: ImportEntry[] }
    >();
    for (const row of ready) {
      for (const [session, yieldL] of Object.entries(row.data.sessions) as [
        MilkSession,
        number,
      ][]) {
        const key = `${row.data.date}:${session}`;
        const group = groups.get(key) ?? {
          date: row.data.date,
          session,
          entries: [],
        };
        group.entries.push({
          cattleId: row.data.cattleId,
          yieldL,
          tankId: row.data.tankId ?? undefined,
        });
        groups.set(key, group);
      }
    }

    let imported = 0;
    let failedGroups = 0;
    for (const group of groups.values()) {
      try {
        const result = await this.milkService.saveLog(farmId, userId, {
          date: group.date,
          session: group.session,
          entries: group.entries,
        });
        imported += result.saved;
      } catch (error) {
        failedGroups += 1;
        this.log.warn('Milk import group failed to save', {
          farmId,
          date: group.date,
          session: group.session,
          error: String(error),
        });
      }
    }

    await this.cache.delete(this.sessionKey(farmId, dto.importSessionId));
    this.log.info('Milk import confirmed', {
      farmId,
      imported,
      skipped: errorRows.length,
      failedGroups,
    });

    return { imported, skipped: errorRows.length, failedGroups };
  }

  // ---- internals ----------------------------------------------------------

  private validateRow(
    record: Record<string, string>,
    rowNumber: number,
    ctx: { cattleByTag: Map<string, string>; tankByName: Map<string, string> },
  ): PreviewRow {
    const read = (header: string) => {
      const value = record[header];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    };

    const dateRaw = read('date');
    const tag = read('cow tag') ?? read('cow id') ?? read('tag');
    const base: PreviewRow = {
      row: rowNumber,
      date: dateRaw,
      tag,
      status: 'error',
    };

    if (!tag) {
      return { ...base, error: 'Missing Cow Tag' };
    }
    const cattleId = ctx.cattleByTag.get(tag.toLowerCase());
    if (!cattleId) {
      return { ...base, error: `Unknown cow tag: "${tag}"` };
    }

    if (!dateRaw) {
      return { ...base, error: 'Missing Date' };
    }
    const parsedDate = new Date(dateRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return { ...base, error: `Invalid Date: "${dateRaw}"` };
    }
    const date = parsedDate.toISOString().slice(0, 10);

    const sessions: Partial<Record<MilkSession, number>> = {};
    for (const [header, session] of Object.entries(SESSION_COLUMNS)) {
      const raw = read(header);
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        return { ...base, date, error: `Invalid ${header} yield: "${raw}"` };
      }
      sessions[session] = value;
    }
    if (Object.keys(sessions).length === 0) {
      return {
        ...base,
        date,
        error: 'No session yield provided (Morning/Noon/Evening/Night)',
      };
    }

    const tankRaw = read('tank') ?? read('tank id');
    let tankId: string | null = null;
    if (tankRaw) {
      tankId = ctx.tankByName.get(tankRaw.toLowerCase()) ?? null;
      if (!tankId) {
        return { ...base, date, error: `Unknown tank: "${tankRaw}"` };
      }
    }

    return {
      row: rowNumber,
      date,
      tag,
      status: 'ready',
      data: { date, cattleId, tankId, sessions },
    };
  }

  /** Row 1 = headers (case-insensitive, trimmed); mirrors `CattleImportService
   * .parseWorkbook` — same exceljs-based reader, same `Record<string,string>`
   * output shape. */
  private async parseWorkbook(
    buffer: Buffer,
  ): Promise<Record<string, string>[]> {
    const workbook = new Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch (error) {
      throw new BadRequestException(
        `Could not parse Excel file: ${String(error)}`,
      );
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel file has no worksheet');
    }

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber] = this.cellToString(cell.value).toLowerCase();
    });

    const records: Record<string, string>[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const record: Record<string, string> = {};
      let hasValue = false;
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (!header) return;
        const value = this.cellToString(cell.value);
        if (value) hasValue = true;
        record[header] = value;
      });
      if (hasValue) records.push(record);
    }
    return records;
  }

  private cellToString(value: CellValue): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      const rich = value as { text?: string; result?: unknown };
      if (typeof rich.text === 'string') return rich.text.trim();
      if (typeof rich.result === 'string' || typeof rich.result === 'number') {
        return String(rich.result).trim();
      }
      return '';
    }
    return String(value).trim();
  }

  private sessionKey(farmId: string, sessionId: string) {
    return `milk:import:${farmId}:${sessionId}`;
  }
}
