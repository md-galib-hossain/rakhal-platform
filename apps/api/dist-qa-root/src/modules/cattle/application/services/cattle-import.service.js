"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CattleImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CattleImportService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const exceljs_1 = require("exceljs");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const cache_service_1 = require("src/core/cache/cache.service");
const tx_context_1 = require("src/core/database/prisma/tx-context");
const animal_event_write_service_1 = require("src/modules/animal-events/application/services/animal-event-write.service");
const aqr_service_1 = require("src/modules/activity/application/services/aqr.service");
const reproduction_derivation_service_1 = require("src/modules/reproduction/application/services/reproduction-derivation.service");
const cattle_constants_1 = require("../../domain/cattle.constants");
const history_event_1 = require("../../domain/history-event");
const SOURCE_TYPE_ALIASES = {
    purchased: client_1.CattleSourceType.PURCHASED,
    born: client_1.CattleSourceType.BORN,
    born_on_farm: client_1.CattleSourceType.BORN,
    gifted: client_1.CattleSourceType.GIFTED,
    unknown: client_1.CattleSourceType.UNKNOWN,
};
const BOOLEAN_ALIASES = {
    true: true,
    yes: true,
    y: true,
    '1': true,
    false: false,
    no: false,
    n: false,
    '0': false,
};
const DEFAULT_GESTATION_DAYS = 280;
const GENDER_ALIASES = {
    female: client_1.CattleGender.FEMALE,
    f: client_1.CattleGender.FEMALE,
    cow: client_1.CattleGender.FEMALE,
    male: client_1.CattleGender.MALE,
    m: client_1.CattleGender.MALE,
    bull: client_1.CattleGender.MALE,
    castrated: client_1.CattleGender.CASTRATED_MALE,
    castrated_male: client_1.CattleGender.CASTRATED_MALE,
    steer: client_1.CattleGender.CASTRATED_MALE,
};
const SESSION_TTL_SECONDS = 30 * 60;
let CattleImportService = CattleImportService_1 = class CattleImportService {
    prisma;
    cache;
    aqrService;
    derivation;
    logger;
    eventWriter;
    log;
    constructor(prisma, cache, aqrService, derivation, logger, eventWriter) {
        this.prisma = prisma;
        this.cache = cache;
        this.aqrService = aqrService;
        this.derivation = derivation;
        this.logger = logger;
        this.eventWriter = eventWriter;
        this.log = this.logger.setContext(CattleImportService_1.name);
    }
    async preview(farmId, file, mappingJson) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('An Excel (.xlsx) file is required');
        }
        const mapping = this.parseMapping(mappingJson);
        const records = await this.parseWorkbook(file.buffer);
        if (records.length === 0) {
            throw new common_1.BadRequestException('Excel file has no data rows');
        }
        const [breeds, sheds, existingTags] = await Promise.all([
            this.prisma.breed.findMany({
                where: { farmId, deletedAt: null },
                select: { id: true, name: true },
            }),
            this.prisma.shed.findMany({
                where: { farmId, deletedAt: null },
                select: { id: true, name: true },
            }),
            this.prisma.cattle.findMany({
                where: { farmId },
                select: { tagNumber: true },
            }),
        ]);
        const breedByName = this.byLowerName(breeds);
        const shedByName = this.byLowerName(sheds);
        const takenTags = new Set(existingTags.map((c) => c.tagNumber.toLowerCase()));
        const seenInFile = new Set();
        const rows = records.map((record, index) => this.validateRow(record, index + 1, mapping, {
            breedByName,
            shedByName,
            takenTags,
            seenInFile,
        }));
        const importSessionId = (0, node_crypto_1.randomUUID)();
        await this.cache.set(this.sessionKey(farmId, importSessionId), { rows }, SESSION_TTL_SECONDS);
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
    async confirm(farmId, userId, dto) {
        const session = await this.cache.get(this.sessionKey(farmId, dto.importSessionId));
        if (!session) {
            throw new common_1.BadRequestException('Import session expired or not found');
        }
        const errorRows = session.rows.filter((r) => r.status === 'error');
        if (errorRows.length > 0 && !dto.skipErrors) {
            throw new common_1.BadRequestException(`Import has ${errorRows.length} invalid row(s); resolve them or set skipErrors`);
        }
        const ready = session.rows.filter((r) => r.status === 'ready' && Boolean(r.data));
        const created = [];
        await this.prisma.$transaction(async (tx) => {
            for (const r of ready) {
                const cattle = await tx.cattle.create({
                    data: {
                        farmId,
                        name: r.data.name,
                        tagNumber: r.data.tagNumber,
                        gender: r.data.gender,
                        dateOfBirth: r.data.dateOfBirth
                            ? new Date(r.data.dateOfBirth)
                            : undefined,
                        breedId: r.data.breedId ?? undefined,
                        shedId: r.data.shedId ?? undefined,
                        color: r.data.color ?? undefined,
                        notes: r.data.notes ?? undefined,
                        sourceType: r.data.sourceType,
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
                        ...(r.data.gender === client_1.CattleGender.FEMALE
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
                if (r.data.isPregnant) {
                    const conceptionDate = r.data.conceptionDate
                        ? new Date(r.data.conceptionDate)
                        : this.addDays(new Date(r.data.expectedCalvingDate), -DEFAULT_GESTATION_DAYS);
                    const expectedCalvingDate = r.data.expectedCalvingDate
                        ? new Date(r.data.expectedCalvingDate)
                        : this.addDays(conceptionDate, DEFAULT_GESTATION_DAYS);
                    const diagnosis = await tx.pregnancyDiagnosis.create({
                        data: {
                            cattleId: cattle.id,
                            diagnosisDate: new Date(),
                            result: client_1.PregnancyDiagnosisResult.PREGNANT,
                            diagnosisMethod: client_1.PregnancyDiagnosisMethod.PURCHASE_INTAKE,
                            expectedCalvingDate,
                        },
                    });
                    await tx.pregnancy.create({
                        data: {
                            cattleId: cattle.id,
                            conceptionDate,
                            expectedCalvingDate,
                            status: client_1.PregnancyStatus.ACTIVE,
                            sourceDiagnosisId: diagnosis.id,
                        },
                    });
                }
                if (r.data.productionStatus === client_1.ProductionStatus.MILKING) {
                    const now = new Date();
                    const startDate = r.data.estimatedDaysInMilk !== null
                        ? this.addDays(now, -r.data.estimatedDaysInMilk)
                        : r.data.lactationStartDate
                            ? new Date(r.data.lactationStartDate)
                            : now;
                    await tx.lactation.create({
                        data: {
                            cattleId: cattle.id,
                            lactationNumber: r.data.estimatedLactationNumber ?? 1,
                            startDate,
                            status: client_1.LactationStatus.ACTIVE,
                            startReason: client_1.LactationStartReason.PURCHASED_LACTATING,
                            isEstimated: true,
                            estimatedLactationNumber: r.data.estimatedLactationNumber,
                            estimatedDaysInMilk: r.data.estimatedDaysInMilk,
                        },
                    });
                }
                if (r.data.productionStatus === client_1.ProductionStatus.DRY) {
                    await tx.dryPeriod.create({
                        data: {
                            cattleId: cattle.id,
                            startDate: new Date(r.data.dryOffStartDate),
                        },
                    });
                }
                for (const h of r.data.history) {
                    const ev = (0, history_event_1.historyEvent)(h);
                    if (!ev || !this.eventWriter)
                        continue;
                    await tx_context_1.txStore.run({ tx }, () => this.eventWriter.record(farmId, userId, cattle.id, {
                        type: ev.type,
                        eventAt: ev.eventAt,
                        provenance: 'HISTORICAL',
                        payload: ev.payload,
                    }));
                }
                created.push({
                    id: cattle.id,
                    tagNumber: r.data.tagNumber,
                    motherTag: r.data.motherTag,
                    fatherTag: r.data.fatherTag,
                });
            }
        });
        const parentRows = created.filter((c) => c.motherTag || c.fatherTag);
        if (parentRows.length > 0) {
            const byTagInBatch = new Map(created.map((c) => [c.tagNumber.toLowerCase(), c.id]));
            const wantedTags = new Set();
            for (const c of parentRows) {
                if (c.motherTag)
                    wantedTags.add(c.motherTag.toLowerCase());
                if (c.fatherTag)
                    wantedTags.add(c.fatherTag.toLowerCase());
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
    validateRow(record, rowNumber, mapping, ctx) {
        const read = (field) => {
            const header = (mapping[field] ?? field).toLowerCase();
            const value = record[header];
            return typeof value === 'string' && value.trim() ? value.trim() : null;
        };
        const name = read('name');
        const tag = read('tag');
        const base = { row: rowNumber, name, tag, status: 'error' };
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
        const dobRaw = read('date_of_birth');
        let dateOfBirth = null;
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
        let breedId = null;
        if (breedRaw) {
            breedId = ctx.breedByName.get(breedRaw.toLowerCase()) ?? null;
            if (!breedId) {
                return { ...base, error: `Unknown breed: "${breedRaw}"` };
            }
        }
        const shedRaw = read('shed');
        let shedId = null;
        if (shedRaw) {
            shedId = ctx.shedByName.get(shedRaw.toLowerCase()) ?? null;
            if (!shedId) {
                return { ...base, error: `Unknown shed: "${shedRaw}"` };
            }
        }
        const priorCalvingsRaw = read('prior_calvings');
        let priorCalvings = null;
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
        const productionStatusRaw = read('production_status');
        let productionStatus = null;
        if (productionStatusRaw) {
            const upper = productionStatusRaw.toUpperCase();
            if (upper !== client_1.ProductionStatus.MILKING &&
                upper !== client_1.ProductionStatus.DRY) {
                return {
                    ...base,
                    error: `Invalid production_status: "${productionStatusRaw}" (must be MILKING or DRY)`,
                };
            }
            productionStatus = upper;
        }
        const lactationStartDateRaw = read('lactation_start_date');
        let lactationStartDate = null;
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
        let estimatedDaysInMilk = null;
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
        let estimatedLactationNumber = null;
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
        if (productionStatus === client_1.ProductionStatus.MILKING && !priorCalvings) {
            return {
                ...base,
                error: 'production_status MILKING requires prior_calvings (a heifer with no calving history cannot be Milking)',
            };
        }
        if (productionStatus === client_1.ProductionStatus.MILKING &&
            !lactationStartDate &&
            estimatedDaysInMilk === null) {
            return {
                ...base,
                error: 'production_status MILKING requires lactation_start_date or estimated_days_in_milk',
            };
        }
        const dryOffStartDateRaw = read('dry_off_start_date');
        let dryOffStartDate = null;
        if (dryOffStartDateRaw) {
            const parsed = new Date(dryOffStartDateRaw);
            if (Number.isNaN(parsed.getTime())) {
                return {
                    ...base,
                    error: `Invalid dry_off_start_date: "${dryOffStartDateRaw}"`,
                };
            }
            dryOffStartDate = parsed.toISOString();
        }
        if (productionStatus === client_1.ProductionStatus.DRY && !dryOffStartDate) {
            return {
                ...base,
                error: 'production_status DRY requires dry_off_start_date',
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
        let conceptionDate = null;
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
        let expectedCalvingDate = null;
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
                error: 'is_pregnant requires conception_date or expected_calving_date (at least one)',
            };
        }
        const bcsRaw = read('bcs');
        let bcs = null;
        if (bcsRaw) {
            const parsed = Number(bcsRaw);
            if (!cattle_constants_1.BCS_ALLOWED_SCORES.includes(parsed)) {
                return {
                    ...base,
                    error: `Invalid bcs: "${bcsRaw}" (must be 1–5 in 0.25 steps)`,
                };
            }
            bcs = parsed;
        }
        const weightKgRaw = read('weight_kg');
        let weightKg = null;
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
        let sourceType = client_1.CattleSourceType.PURCHASED;
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
        const motherTag = read('mother_tag');
        const fatherTag = read('father_tag');
        const history = [];
        const readDate = (field) => {
            const raw = read(field);
            if (!raw)
                return { iso: null, bad: false };
            const parsed = new Date(raw);
            return Number.isNaN(parsed.getTime())
                ? { iso: null, bad: true }
                : { iso: parsed.toISOString(), bad: false };
        };
        const lastCalvingD = readDate('last_calving_date');
        const lastBreedingD = readDate('last_breeding_date');
        const lastVaccinationD = readDate('last_vaccination_date');
        for (const [field, d] of [
            ['last_calving_date', lastCalvingD],
            ['last_breeding_date', lastBreedingD],
            ['last_vaccination_date', lastVaccinationD],
        ]) {
            if (d.bad) {
                return { ...base, error: `Invalid ${field}: "${read(field)}"` };
            }
        }
        const lastCalving = lastCalvingD.iso;
        const lastBreeding = lastBreedingD.iso;
        const lastVaccination = lastVaccinationD.iso;
        if (lastCalving) {
            const n = Number(read('last_calving_number'));
            history.push({
                kind: 'LAST_CALVING',
                date: lastCalving,
                ...(Number.isInteger(n) && n >= 1 && n <= 20
                    ? { calvingNumber: n }
                    : {}),
            });
        }
        if (lastBreeding) {
            const methodRaw = read('last_breeding_method');
            const method = methodRaw
                ? client_1.BreedingMethod[methodRaw.toUpperCase()]
                : undefined;
            if (methodRaw && !method) {
                return {
                    ...base,
                    error: `Invalid last_breeding_method: "${methodRaw}" (must be one of ${Object.values(client_1.BreedingMethod).join(', ')})`,
                };
            }
            history.push({
                kind: 'LAST_BREEDING',
                date: lastBreeding,
                ...(method ? { method } : {}),
                ...(read('last_breeding_bull')
                    ? { bull: read('last_breeding_bull') }
                    : {}),
            });
        }
        const monthsRaw = read('months_pregnant');
        if (monthsRaw) {
            const months = Number(monthsRaw);
            if (!Number.isInteger(months) || months < 1 || months > 9) {
                return {
                    ...base,
                    error: `Invalid months_pregnant: "${monthsRaw}" (whole number 1 to 9)`,
                };
            }
            if (isPregnant) {
                return {
                    ...base,
                    error: 'Use either is_pregnant (with a date) or months_pregnant, not both',
                };
            }
            history.push({ kind: 'PREGNANT', monthsPregnant: months });
        }
        if (lastVaccination) {
            history.push({
                kind: 'LAST_VACCINATION',
                date: lastVaccination,
                ...(read('last_vaccination_product')
                    ? { product: read('last_vaccination_product') }
                    : {}),
            });
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
                dateOfBirth,
                breedId,
                shedId,
                color: read('color'),
                notes: read('notes'),
                priorCalvings,
                productionStatus,
                lactationStartDate,
                dryOffStartDate,
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
                history,
            },
        };
    }
    async parseWorkbook(buffer) {
        const workbook = new exceljs_1.Workbook();
        try {
            await workbook.xlsx.load(buffer);
        }
        catch (error) {
            throw new common_1.BadRequestException(`Could not parse Excel file: ${String(error)}`);
        }
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            throw new common_1.BadRequestException('Excel file has no worksheet');
        }
        const headers = [];
        sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
            headers[colNumber] = this.cellToString(cell.value).toLowerCase();
        });
        const records = [];
        for (let r = 2; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const record = {};
            let hasValue = false;
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const header = headers[colNumber];
                if (!header)
                    return;
                const value = this.cellToString(cell.value);
                if (value)
                    hasValue = true;
                record[header] = value;
            });
            if (hasValue)
                records.push(record);
        }
        return records;
    }
    cellToString(value) {
        if (value === null || value === undefined)
            return '';
        if (value instanceof Date)
            return value.toISOString().slice(0, 10);
        if (typeof value === 'object') {
            const rich = value;
            if (typeof rich.text === 'string')
                return rich.text.trim();
            if (typeof rich.result === 'string' || typeof rich.result === 'number') {
                return String(rich.result).trim();
            }
            return '';
        }
        return String(value).trim();
    }
    parseMapping(mappingJson) {
        if (!mappingJson) {
            return {};
        }
        try {
            const parsed = JSON.parse(mappingJson);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch {
            throw new common_1.BadRequestException('mapping must be valid JSON');
        }
    }
    byLowerName(items) {
        return new Map(items.map((i) => [i.name.toLowerCase(), i.id]));
    }
    sessionKey(farmId, sessionId) {
        return `cattle:import:${farmId}:${sessionId}`;
    }
    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    async buildTemplate() {
        const workbook = new exceljs_1.Workbook();
        const sheet = workbook.addWorksheet('Cattle');
        const headers = [
            'tag',
            'name',
            'gender',
            'date_of_birth',
            'breed',
            'shed',
            'color',
            'notes',
            'prior_calvings',
            'production_status',
            'lactation_start_date',
            'dry_off_start_date',
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
            'last_calving_date',
            'last_calving_number',
            'last_breeding_date',
            'last_breeding_method',
            'last_breeding_bull',
            'months_pregnant',
            'last_vaccination_date',
            'last_vaccination_product',
        ];
        sheet.addRow(headers);
        sheet.addRow([
            'COW-001',
            'Laxmi',
            'FEMALE',
            '2021-05-14',
            '',
            '',
            '',
            '',
            '2',
            'MILKING',
            '2026-06-01',
            '',
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
            '2026-06-01',
            '2',
            '',
            '',
            '',
            '',
            '2026-08-01',
            'FMD',
        ]);
        return (await workbook.xlsx.writeBuffer());
    }
};
exports.CattleImportService = CattleImportService;
exports.CattleImportService = CattleImportService = CattleImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        aqr_service_1.AqrService,
        reproduction_derivation_service_1.ReproductionDerivationService,
        logger_service_1.LoggerService,
        animal_event_write_service_1.AnimalEventWriteService])
], CattleImportService);
//# sourceMappingURL=cattle-import.service.js.map