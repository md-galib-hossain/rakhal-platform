import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook, type CellValue } from 'exceljs';
import {
  CattleGender,
  CattlePurpose,
  CattleSourceType,
  LactationStartReason,
  LactationStatus,
  PregnancyDiagnosisMethod,
  PregnancyDiagnosisResult,
  PregnancyStatus,
  ProductionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CacheService } from 'src/core/cache/cache.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
// RAKHAL-308: end each imported cow's intake with the same recompute every
// other reproduction/lactation write uses (mirrors `CattleService.create()`'s
// own `refreshDerivedState` call) so the derived fields are correct
// immediately, not just on the next GET.
import { ReproductionDerivationService } from 'src/modules/reproduction/application/services/reproduction-derivation.service';
import { BCS_ALLOWED_SCORES } from '../../domain/cattle.constants';
import { ImportConfirmDto } from '../../presentation/dto/import-cattle.dto';

/** Canonical CSV columns (PRD §8.4, RAKHAL-308's real-state columns). Headers
 * are matched case-insensitively. */
type CanonicalField =
  | 'name'
  | 'tag'
  | 'gender'
  | 'purpose'
  | 'date_of_birth'
  | 'breed'
  | 'shed'
  | 'color'
  | 'notes'
  | 'prior_calvings'
  | 'production_status'
  | 'lactation_start_date'
  | 'estimated_days_in_milk'
  | 'estimated_lactation_number'
  | 'is_pregnant'
  | 'conception_date'
  | 'expected_calving_date'
  | 'bcs'
  | 'weight_kg'
  | 'source_type'
  | 'mother_tag'
  | 'father_tag';

const SOURCE_TYPE_ALIASES: Record<string, CattleSourceType> = {
  purchased: CattleSourceType.PURCHASED,
  born: CattleSourceType.BORN,
  born_on_farm: CattleSourceType.BORN,
  gifted: CattleSourceType.GIFTED,
  unknown: CattleSourceType.UNKNOWN,
};

const BOOLEAN_ALIASES: Record<string, boolean> = {
  true: true,
  yes: true,
  y: true,
  '1': true,
  false: false,
  no: false,
  n: false,
  '0': false,
};

/** Mirrors `CattleService.create()`'s own fallback (`reproduction.service.ts`'s
 * close-up projection uses the same literal) — duplicated rather than
 * cross-module-imported since it's a plain constant, not worth the coupling. */
const DEFAULT_GESTATION_DAYS = 280;

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
  /** Real prior calving history for an already-calved purchased cow — lets
   * bulk import seed `ReproductionProfile.totalCalvings` the same way
   * `CreateCattleDto.priorCalvings` does for a single intake, instead of
   * every imported row always defaulting to 0. */
  priorCalvings: number | null;
  // RAKHAL-308: real-state columns, mirroring CreateCattleDto's own intake
  // fields (RAKHAL-307) so a bulk-imported already-calved/already-pregnant/
  // already-milking cow lands in the same real state a single manual intake
  // would, instead of every row defaulting to a bare heifer.
  productionStatus: ProductionStatus | null;
  lactationStartDate: string | null;
  estimatedDaysInMilk: number | null;
  estimatedLactationNumber: number | null;
  isPregnant: boolean;
  conceptionDate: string | null;
  expectedCalvingDate: string | null;
  bcs: number | null;
  weightKg: number | null;
  sourceType: CattleSourceType;
  motherTag: string | null;
  fatherTag: string | null;
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
    private readonly derivation: ReproductionDerivationService,
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
      throw new BadRequestException('An Excel (.xlsx) file is required');
    }

    const mapping = this.parseMapping(mappingJson);
    const records = await this.parseWorkbook(file.buffer);
    if (records.length === 0) {
      throw new BadRequestException('Excel file has no data rows');
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

    // RAKHAL-308: one row at a time inside an interactive transaction (was a
    // flat array of `cattle.create` calls) so each row can also write its
    // real-state PregnancyDiagnosis/Pregnancy/Lactation, mirroring
    // `CattleService.create()`'s own intake transaction shape.
    const created: {
      id: string;
      tagNumber: string;
      motherTag: string | null;
      fatherTag: string | null;
    }[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const r of ready) {
        const cattle = await tx.cattle.create({
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
            // RAKHAL-308: `source_type` is now a real column (defaulting
            // PURCHASED), replacing the previous hardcode here.
            sourceType: r.data.sourceType,
            productionStatus: r.data.productionStatus ?? undefined,
            lastBcs: r.data.bcs ?? undefined,
            lastWeightKg: r.data.weightKg ?? undefined,
            createdBy: userId,
            ...(r.data.bcs
              ? {
                  bcsRecords: {
                    create: {
                      score: r.data.bcs,
                      recordedDate: new Date(),
                      recordedBy: userId,
                    },
                  },
                }
              : {}),
            // Same seam as `CattleService.create()`'s `priorCalvings` — an
            // already-calved purchased cow can record her real calving count
            // at intake instead of defaulting to 0 via the Prisma schema
            // default, which is what let a purchased-milking cow miscategorize
            // as a heifer. Every FEMALE gets a ReproductionProfile, mirroring
            // RAKHAL-307's create() guarantee.
            ...(r.data.gender === CattleGender.FEMALE
              ? {
                  reproductionProfile: {
                    create: {
                      ...(r.data.priorCalvings
                        ? { totalCalvings: r.data.priorCalvings }
                        : {}),
                    },
                  },
                }
              : {}),
          },
          select: { id: true },
        });

        // RAKHAL-308: "she is already pregnant" — same synthetic
        // PregnancyDiagnosis (method PURCHASE_INTAKE) + Pregnancy shape as
        // CattleService.create()'s intakePregnancy, so the row is editable
        // via RAKHAL-305 and shows in the events feed.
        if (r.data.isPregnant) {
          const conceptionDate = r.data.conceptionDate
            ? new Date(r.data.conceptionDate)
            : this.addDays(
                new Date(r.data.expectedCalvingDate!),
                -DEFAULT_GESTATION_DAYS,
              );
          const expectedCalvingDate = r.data.expectedCalvingDate
            ? new Date(r.data.expectedCalvingDate)
            : this.addDays(conceptionDate, DEFAULT_GESTATION_DAYS);

          const diagnosis = await tx.pregnancyDiagnosis.create({
            data: {
              cattleId: cattle.id,
              diagnosisDate: new Date(),
              result: PregnancyDiagnosisResult.PREGNANT,
              diagnosisMethod: PregnancyDiagnosisMethod.PURCHASE_INTAKE,
              expectedCalvingDate,
            },
          });
          await tx.pregnancy.create({
            data: {
              cattleId: cattle.id,
              conceptionDate,
              expectedCalvingDate,
              status: PregnancyStatus.ACTIVE,
              sourceDiagnosisId: diagnosis.id,
            },
          });
        }

        // RAKHAL-308: "she is already milking" — same precedence as
        // CattleService.create()'s intakeLactation (DIM > lactation_start_date
        // > now).
        if (r.data.productionStatus === ProductionStatus.MILKING) {
          const now = new Date();
          const startDate =
            r.data.estimatedDaysInMilk !== null
              ? this.addDays(now, -r.data.estimatedDaysInMilk)
              : r.data.lactationStartDate
                ? new Date(r.data.lactationStartDate)
                : now;
          await tx.lactation.create({
            data: {
              cattleId: cattle.id,
              lactationNumber: r.data.estimatedLactationNumber ?? 1,
              startDate,
              status: LactationStatus.ACTIVE,
              startReason: LactationStartReason.PURCHASED_LACTATING,
              isEstimated: true,
              estimatedLactationNumber: r.data.estimatedLactationNumber,
              estimatedDaysInMilk: r.data.estimatedDaysInMilk,
            },
          });
        }

        created.push({
          id: cattle.id,
          tagNumber: r.data.tagNumber,
          motherTag: r.data.motherTag,
          fatherTag: r.data.fatherTag,
        });
      }
    });

    // RAKHAL-308: mother_tag/father_tag second pass — runs only after every
    // row in the file is inserted, so a forward reference (a calf on row 3
    // pointing at her mother on row 40) resolves correctly. Best-effort: a
    // tag that resolves to nothing (typo, or a tag outside this farm) is
    // logged and skipped rather than failing the whole import.
    const parentRows = created.filter((c) => c.motherTag || c.fatherTag);
    if (parentRows.length > 0) {
      const byTagInBatch = new Map(
        created.map((c) => [c.tagNumber.toLowerCase(), c.id]),
      );
      const wantedTags = new Set<string>();
      for (const c of parentRows) {
        if (c.motherTag) wantedTags.add(c.motherTag.toLowerCase());
        if (c.fatherTag) wantedTags.add(c.fatherTag.toLowerCase());
      }
      const existing = await this.prisma.cattle.findMany({
        where: { farmId, tagNumber: { in: [...wantedTags] } },
        select: { id: true, tagNumber: true },
      });
      for (const e of existing) {
        byTagInBatch.set(e.tagNumber.toLowerCase(), e.id);
      }

      for (const c of parentRows) {
        const motherId = c.motherTag
          ? byTagInBatch.get(c.motherTag.toLowerCase())
          : undefined;
        const fatherId = c.fatherTag
          ? byTagInBatch.get(c.fatherTag.toLowerCase())
          : undefined;
        if (c.motherTag && !motherId) {
          this.log.warn('Import: mother_tag not found, skipped', {
            farmId,
            tagNumber: c.tagNumber,
            motherTag: c.motherTag,
          });
        }
        if (c.fatherTag && !fatherId) {
          this.log.warn('Import: father_tag not found, skipped', {
            farmId,
            tagNumber: c.tagNumber,
            fatherTag: c.fatherTag,
          });
        }
        if (motherId || fatherId) {
          await this.prisma.cattle.update({
            where: { id: c.id },
            data: {
              motherId: motherId ?? undefined,
              fatherId: fatherId ?? undefined,
            },
          });
        }
      }
    }

    // AQR: Animal Registered (+50) per imported cow, for parity with single
    // create; RAKHAL-308 also ends each row with the same derived-state
    // recompute create() uses so the response is immediately correct.
    for (const cattle of created) {
      await this.derivation.refreshDerivedState(farmId, cattle.id);
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

    const priorCalvingsRaw = read('prior_calvings');
    let priorCalvings: number | null = null;
    if (priorCalvingsRaw) {
      const parsed = Number(priorCalvingsRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return {
          ...base,
          error: `Invalid prior_calvings: "${priorCalvingsRaw}" (must be a whole number >= 1)`,
        };
      }
      priorCalvings = parsed;
    }

    // RAKHAL-308: real-state columns below. Each is optional; a missing value
    // simply leaves the cow in her default (heifer, no production status)
    // state — same non-breaking shape RAKHAL-307's intake fields use.

    const productionStatusRaw = read('production_status');
    let productionStatus: ProductionStatus | null = null;
    if (productionStatusRaw) {
      const upper = productionStatusRaw.toUpperCase();
      if (
        upper !== ProductionStatus.MILKING &&
        upper !== ProductionStatus.DRY
      ) {
        return {
          ...base,
          error: `Invalid production_status: "${productionStatusRaw}" (must be MILKING or DRY)`,
        };
      }
      productionStatus = upper;
    }

    const lactationStartDateRaw = read('lactation_start_date');
    let lactationStartDate: string | null = null;
    if (lactationStartDateRaw) {
      const parsed = new Date(lactationStartDateRaw);
      if (Number.isNaN(parsed.getTime())) {
        return {
          ...base,
          error: `Invalid lactation_start_date: "${lactationStartDateRaw}"`,
        };
      }
      lactationStartDate = parsed.toISOString();
    }

    const estimatedDaysInMilkRaw = read('estimated_days_in_milk');
    let estimatedDaysInMilk: number | null = null;
    if (estimatedDaysInMilkRaw) {
      const parsed = Number(estimatedDaysInMilkRaw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return {
          ...base,
          error: `Invalid estimated_days_in_milk: "${estimatedDaysInMilkRaw}" (must be a whole number >= 0)`,
        };
      }
      estimatedDaysInMilk = parsed;
    }

    const estimatedLactationNumberRaw = read('estimated_lactation_number');
    let estimatedLactationNumber: number | null = null;
    if (estimatedLactationNumberRaw) {
      const parsed = Number(estimatedLactationNumberRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return {
          ...base,
          error: `Invalid estimated_lactation_number: "${estimatedLactationNumberRaw}" (must be a whole number >= 1)`,
        };
      }
      estimatedLactationNumber = parsed;
    }

    if (productionStatus === ProductionStatus.MILKING && !priorCalvings) {
      return {
        ...base,
        error:
          'production_status MILKING requires prior_calvings (a heifer with no calving history cannot be Milking)',
      };
    }
    if (
      productionStatus === ProductionStatus.MILKING &&
      !lactationStartDate &&
      estimatedDaysInMilk === null
    ) {
      return {
        ...base,
        error:
          'production_status MILKING requires lactation_start_date or estimated_days_in_milk',
      };
    }

    const isPregnantRaw = read('is_pregnant');
    let isPregnant = false;
    if (isPregnantRaw) {
      const parsed = BOOLEAN_ALIASES[isPregnantRaw.toLowerCase()];
      if (parsed === undefined) {
        return {
          ...base,
          error: `Invalid is_pregnant: "${isPregnantRaw}" (use true/false)`,
        };
      }
      isPregnant = parsed;
    }

    const conceptionDateRaw = read('conception_date');
    let conceptionDate: string | null = null;
    if (conceptionDateRaw) {
      const parsed = new Date(conceptionDateRaw);
      if (Number.isNaN(parsed.getTime())) {
        return {
          ...base,
          error: `Invalid conception_date: "${conceptionDateRaw}"`,
        };
      }
      conceptionDate = parsed.toISOString();
    }

    const expectedCalvingDateRaw = read('expected_calving_date');
    let expectedCalvingDate: string | null = null;
    if (expectedCalvingDateRaw) {
      const parsed = new Date(expectedCalvingDateRaw);
      if (Number.isNaN(parsed.getTime())) {
        return {
          ...base,
          error: `Invalid expected_calving_date: "${expectedCalvingDateRaw}"`,
        };
      }
      expectedCalvingDate = parsed.toISOString();
    }

    if (isPregnant && !conceptionDate && !expectedCalvingDate) {
      return {
        ...base,
        error:
          'is_pregnant requires conception_date or expected_calving_date (at least one)',
      };
    }

    const bcsRaw = read('bcs');
    let bcs: number | null = null;
    if (bcsRaw) {
      const parsed = Number(bcsRaw);
      if (!BCS_ALLOWED_SCORES.includes(parsed)) {
        return {
          ...base,
          error: `Invalid bcs: "${bcsRaw}" (must be 1–5 in 0.25 steps)`,
        };
      }
      bcs = parsed;
    }

    const weightKgRaw = read('weight_kg');
    let weightKg: number | null = null;
    if (weightKgRaw) {
      const parsed = Number(weightKgRaw);
      if (!Number.isFinite(parsed) || parsed < 10 || parsed > 2000) {
        return {
          ...base,
          error: `Invalid weight_kg: "${weightKgRaw}" (must be between 10 and 2000)`,
        };
      }
      weightKg = parsed;
    }

    const sourceTypeRaw = read('source_type');
    let sourceType: CattleSourceType = CattleSourceType.PURCHASED;
    if (sourceTypeRaw) {
      const resolved = SOURCE_TYPE_ALIASES[sourceTypeRaw.toLowerCase()];
      if (!resolved) {
        return {
          ...base,
          error: `Invalid source_type: "${sourceTypeRaw}" (must be one of PURCHASED, BORN, GIFTED, UNKNOWN)`,
        };
      }
      sourceType = resolved;
    }

    // mother_tag/father_tag are resolved in a second pass after every row is
    // inserted (forward references), so only capture the raw tag here.
    const motherTag = read('mother_tag');
    const fatherTag = read('father_tag');

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
        priorCalvings,
        productionStatus,
        lactationStartDate,
        estimatedDaysInMilk,
        estimatedLactationNumber,
        isPregnant,
        conceptionDate,
        expectedCalvingDate,
        bcs,
        weightKg,
        sourceType,
        motherTag,
        fatherTag,
      },
    };
  }

  /** Row 1 = headers (case-insensitive, trimmed); every row after is one record,
   * keyed the same way `csv-parse`'s `columns` option used to (lowercased header
   * → cell value), so `validateRow` needed zero changes when this replaced CSV. */
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

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /** Downloadable import template (RAKHAL-308) — one worksheet with every
   * canonical header (original 9 + the 12 real-state columns) and a sample
   * row, so a farm can fill it in and re-upload via `import/preview`. */
  async buildTemplate(): Promise<Buffer> {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Cattle');
    const headers: CanonicalField[] = [
      'tag',
      'name',
      'gender',
      'purpose',
      'date_of_birth',
      'breed',
      'shed',
      'color',
      'notes',
      'prior_calvings',
      'production_status',
      'lactation_start_date',
      'estimated_days_in_milk',
      'estimated_lactation_number',
      'is_pregnant',
      'conception_date',
      'expected_calving_date',
      'bcs',
      'weight_kg',
      'source_type',
      'mother_tag',
      'father_tag',
    ];
    sheet.addRow(headers);
    sheet.addRow([
      'COW-001',
      'Laxmi',
      'FEMALE',
      'MILK',
      '2021-05-14',
      '',
      '',
      '',
      '',
      '2',
      'MILKING',
      '2026-06-01',
      '',
      '2',
      'false',
      '',
      '',
      '3.5',
      '380',
      'PURCHASED',
      '',
      '',
    ]);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
