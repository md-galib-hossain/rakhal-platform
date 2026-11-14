import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { MilkSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ExportMilkLogDto } from '../../presentation/dto/export-milk-log.dto';

/** Milk log Excel export — same wide shape as the import template (one row
 * per cow+date), so a downloaded file can be edited and re-imported. */
@Injectable()
export class MilkExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportLog(
    farmId: string,
    dto: ExportMilkLogDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const from = this.normalizeDate(dto.from);
    const to = this.normalizeDate(dto.to);

    const entries = await this.prisma.milkLogEntry.findMany({
      where: {
        farmId,
        logDate: { gte: from, lte: to },
        ...(dto.cattleIds?.length ? { cattleId: { in: dto.cattleIds } } : {}),
      },
      include: { cattle: { select: { name: true, tagNumber: true } } },
      orderBy: [{ logDate: 'asc' }, { cattleId: 'asc' }],
    });

    // Group into the wide shape: one row per (date, cow).
    const rows = new Map<
      string,
      {
        date: string;
        tag: string;
        name: string | null;
        sessions: Partial<Record<MilkSession, number>>;
      }
    >();
    for (const entry of entries) {
      const dateStr = entry.logDate.toISOString().slice(0, 10);
      const key = `${dateStr}:${entry.cattleId}`;
      const row = rows.get(key) ?? {
        date: dateStr,
        tag: entry.cattle.tagNumber,
        name: entry.cattle.name,
        sessions: {},
      };
      row.sessions[entry.session] = entry.yieldL;
      rows.set(key, row);
    }

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Milk Log');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Cow Tag', key: 'tag', width: 12 },
      { header: 'Cow Name', key: 'name', width: 16 },
      { header: 'Morning', key: 'morning', width: 10 },
      { header: 'Noon', key: 'noon', width: 10 },
      { header: 'Evening', key: 'evening', width: 10 },
      { header: 'Night', key: 'night', width: 10 },
      { header: 'Total', key: 'total', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of [...rows.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.tag.localeCompare(b.tag),
    )) {
      const morning = row.sessions[MilkSession.MORNING] ?? null;
      const noon = row.sessions[MilkSession.NOON] ?? null;
      const evening = row.sessions[MilkSession.EVENING] ?? null;
      const night = row.sessions[MilkSession.NIGHT] ?? null;
      const total = [morning, noon, evening, night]
        .filter((v): v is number => v !== null)
        .reduce((sum, v) => sum + v, 0);
      sheet.addRow({
        date: row.date,
        tag: row.tag,
        name: row.name ?? '',
        morning,
        noon,
        evening,
        night,
        total: Math.round(total * 10) / 10,
      });
    }

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const filename = `milk-log_${dto.from}_${dto.to}.xlsx`;
    return { buffer, filename };
  }

  private normalizeDate(dateStr: string): Date {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
  }
}
