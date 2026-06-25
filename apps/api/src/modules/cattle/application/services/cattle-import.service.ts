import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import {
  CattleGender,
  CattlePurpose,
  CattleSourceType,
  ProductionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CacheService } from 'src/core/cache/cache.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ImportConfirmDto } from '../../presentation/dto/import-cattle.dto';

/** Canonical CSV columns (PRD §8.4). Headers are matched case-insensitively. */
type CanonicalField =
  | 'name'
  | 'tag'
  | 'gender'
  | 'purpose'
  | 'date_of_birth'
  | 'breed'
  | 'shed'
  | 'color'
  | 'notes';

const GENDER_ALIASES: Record<string, CattleGender> = {
  female: CattleGender.FEMALE,
  f: CattleGender.FEMALE,
  cow: CattleGender.FEMALE,
  male: CattleGender.MALE,
  m: CattleGender.MALE,
  bull: CattleGender.MALE,
  castrated: CattleGender.CASTRATED_MALE,
  castrated_male: CattleGender.CASTRATED_MALE,
  steer: CattleGender.CASTRATED_MALE,
};

const PURPOSE_ALIASES: Record<string, CattlePurpose> = {
  dairy: CattlePurpose.MILK,
  milk: CattlePurpose.MILK,
  breeding: CattlePurpose.BREEDING,
  beef: CattlePurpose.MEAT,
  meat: CattlePurpose.MEAT,
  calf: CattlePurpose.CALF,
  bull: CattlePurpose.BULL_SERVICE,
  bull_service: CattlePurpose.BULL_SERVICE,
  dual: CattlePurpose.DUAL_PURPOSE,
  dual_purpose: CattlePurpose.DUAL_PURPOSE,
};

/** A normalized, import-ready row (only present for `ready` rows). */
interface ImportRowData {
  name: string | null;
  tagNumber: string;
  gender: CattleGender;
  purpose: CattlePurpose;
  dateOfBirth: string | null;
  breedId: string | null;
  shedId: string | null;
  color: string | null;
  notes: string | null;
}

interface PreviewRow {
  row: number;
  name: string | null;
  tag: string | null;
  status: 'ready' | 'error';
  error?: string;
  data?: ImportRowData;
}

interface ImportSession {
  rows: PreviewRow[];
}

const SESSION_TTL_SECONDS = 30 * 60;

/**
 * Cattle CSV import (PRD §8.4, RAKHAL-043). Two-step preview → confirm: the
 * uploaded file is parsed and validated per row, the result is cached under a
 * session id, then `confirm` imports the ready rows. Farm-scoped throughout
 * (breed/shed/duplicate-tag checks all run within `farmId`).
 */
@Injectable()
export class CattleImportService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly aqrService: AqrService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(CattleImportService.name);
  }

  async preview(
    farmId: string,
    file: Express.Multer.File | undefined,
    mappingJson?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A CSV file is required');
    }

    const mapping = this.parseMapping(mappingJson);
    const records = this.parseCsv(file.buffer.toString('utf-8'));
    if (records.length === 0) {
      throw new BadRequestException('CSV file has no data rows');
    }

    const [breeds, sheds, existingTags] = await Promise.all([
      this.prisma.breed.findMany({
        where: { farmId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.shed.findMany({
        where: { farmId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.cattle.findMany({
        where: { farmId },
        select: { tagNumber: true },
      }),
    ]);
    const breedByName = this.byLowerName(breeds);
    const shedByName = this.byLowerName(sheds);
    const takenTags = new Set(
      existingTags.map((c) => c.tagNumber.toLowerCase()),
    );
    const seenInFile = new Set<string>();

    const rows: PreviewRow[] = records.map((record, index) =>
      this.validateRow(record, index + 1, mapping, {
        breedByName,
        shedByName,
        takenTags,
        seenInFile,
      }),
    );

    const importSessionId = randomUUID();
    await this.cache.set<ImportSession>(
      this.sessionKey(farmId, importSessionId),
      { rows },
      SESSION_TTL_SECONDS,
    );

    const errorCount = rows.filter((r) => r.status === 'error').length;
    this.log.info('Cattle import previewed', {
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
        name: r.name,
        tag: r.tag,
        status: r.status,
        error: r.error,
      })),
    };
  }

  async confirm(farmId: string, userId: string, dto: ImportConfirmDto) {
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

    const created = await this.prisma.$transaction(
      ready.map((r) =>
        this.prisma.cattle.create({
          data: {
            farmId,
            name: r.data.name,
            tagNumber: r.data.tagNumber,
            gender: r.data.gender,
            purpose: r.data.purpose,
            dateOfBirth: r.data.dateOfBirth
              ? new Date(r.data.dateOfBirth)
              : undefined,
            breedId: r.data.breedId ?? undefined,
            shedId: r.data.shedId ?? undefined,
            color: r.data.color ?? undefined,
            notes: r.data.notes ?? undefined,
            sourceType: CattleSourceType.PURCHASED,
            productionStatus: ProductionStatus.GROWING,
            createdBy: userId,
          },
          select: { id: true },
        }),
      ),
    );

    // AQR: Animal Registered (+50) per imported cow, for parity with single create.
    for (const cattle of created) {
      await this.aqrService.applyEvent(farmId, cattle.id, 'animal_registered', {
        actorId: userId,
        actionDetails: 'Animal registered via CSV import.',
      });
    }

    await this.cache.delete(this.sessionKey(farmId, dto.importSessionId));
    this.log.info('Cattle import confirmed', {
      farmId,
      imported: created.length,
      skipped: errorRows.length,
    });

    return { imported: created.length, skipped: errorRows.length };
  }

  // ---- internals ----------------------------------------------------------

  private validateRow(
    record: Record<string, string>,
    rowNumber: number,
    mapping: Record<string, string>,
    ctx: {
      breedByName: Map<string, string>;
      shedByName: Map<string, string>;
      takenTags: Set<string>;
      seenInFile: Set<string>;
    },
  ): PreviewRow {
    const read = (field: CanonicalField) => {
      const header = (mapping[field] ?? field).toLowerCase();
      const value = record[header];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    };

    const name = read('name');
    const tag = read('tag');
    const base: PreviewRow = { row: rowNumber, name, tag, status: 'error' };

    if (!tag) {
      return { ...base, error: 'Missing TAG (required, unique per farm)' };
    }
    const tagKey = tag.toLowerCase();
    if (ctx.seenInFile.has(tagKey)) {
      return { ...base, error: 'Duplicate TAG within file' };
    }
    if (ctx.takenTags.has(tagKey)) {
      return { ...base, error: 'Duplicate TAG — already exists for this farm' };
    }

    const genderRaw = read('gender');
    const gender = genderRaw
      ? GENDER_ALIASES[genderRaw.toLowerCase()]
      : undefined;
    if (!gender) {
      return {
        ...base,
        error: `Invalid or missing gender: "${genderRaw ?? ''}"`,
      };
    }

    const purposeRaw = read('purpose');
    const purpose = purposeRaw
      ? PURPOSE_ALIASES[purposeRaw.toLowerCase()]
      : undefined;
    if (!purpose) {
      return {
        ...base,
        error: `Invalid or missing purpose: "${purposeRaw ?? ''}"`,
      };
    }

    const dobRaw = read('date_of_birth');
    let dateOfBirth: string | null = null;
    if (dobRaw) {
      const parsed = new Date(dobRaw);
      if (Number.isNaN(parsed.getTime())) {
        return { ...base, error: `Invalid date_of_birth: "${dobRaw}"` };
      }
      if (parsed.getTime() > Date.now()) {
        return { ...base, error: 'date_of_birth cannot be in the future' };
      }
      dateOfBirth = parsed.toISOString();
    }

    const breedRaw = read('breed');
    let breedId: string | null = null;
    if (breedRaw) {
      breedId = ctx.breedByName.get(breedRaw.toLowerCase()) ?? null;
      if (!breedId) {
        return { ...base, error: `Unknown breed: "${breedRaw}"` };
      }
    }

    const shedRaw = read('shed');
    let shedId: string | null = null;
    if (shedRaw) {
      shedId = ctx.shedByName.get(shedRaw.toLowerCase()) ?? null;
      if (!shedId) {
        return { ...base, error: `Unknown shed: "${shedRaw}"` };
      }
    }

    ctx.seenInFile.add(tagKey);

    return {
      row: rowNumber,
      name,
      tag,
      status: 'ready',
      data: {
        name,
        tagNumber: tag,
        gender,
        purpose,
        dateOfBirth,
        breedId,
        shedId,
        color: read('color'),
        notes: read('notes'),
      },
    };
  }

  private parseCsv(content: string): Record<string, string>[] {
    try {
      return parse(content, {
        columns: (header: string[]) =>
          header.map((h) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });
    } catch (error) {
      throw new BadRequestException(`Could not parse CSV: ${String(error)}`);
    }
  }

  private parseMapping(mappingJson?: string): Record<string, string> {
    if (!mappingJson) {
      return {};
    }
    try {
      const parsed = JSON.parse(mappingJson) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      throw new BadRequestException('mapping must be valid JSON');
    }
  }

  private byLowerName(items: { id: string; name: string }[]) {
    return new Map(items.map((i) => [i.name.toLowerCase(), i.id]));
  }

  private sessionKey(farmId: string, sessionId: string) {
    return `cattle:import:${farmId}:${sessionId}`;
  }
}
