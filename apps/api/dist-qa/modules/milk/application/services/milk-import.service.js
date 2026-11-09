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
var MilkImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkImportService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const exceljs_1 = require("exceljs");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const cache_service_1 = require("src/core/cache/cache.service");
const milk_service_1 = require("./milk.service");
const herd_scope_1 = require("src/modules/cattle/domain/herd-scope");
const SESSION_TTL_SECONDS = 30 * 60;
const SESSION_COLUMNS = {
    morning: client_1.MilkSession.MORNING,
    noon: client_1.MilkSession.NOON,
    evening: client_1.MilkSession.EVENING,
    night: client_1.MilkSession.NIGHT,
};
let MilkImportService = MilkImportService_1 = class MilkImportService {
    prisma;
    cache;
    milkService;
    log;
    constructor(prisma, cache, milkService, logger) {
        this.prisma = prisma;
        this.cache = cache;
        this.milkService = milkService;
        this.log = logger.setContext(MilkImportService_1.name);
    }
    async preview(farmId, file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('An Excel (.xlsx) file is required');
        }
        const records = await this.parseWorkbook(file.buffer);
        if (records.length === 0) {
            throw new common_1.BadRequestException('Excel file has no data rows');
        }
        const [cattle, tanks] = await Promise.all([
            this.prisma.cattle.findMany({
                where: (0, herd_scope_1.activeHerd)(farmId),
                select: { id: true, tagNumber: true },
            }),
            this.prisma.milkTank.findMany({
                where: { farmId, deletedAt: null },
                select: { id: true, name: true },
            }),
        ]);
        const cattleByTag = new Map(cattle.map((c) => [c.tagNumber.toLowerCase(), c.id]));
        const tankByName = new Map(tanks.map((t) => [t.name.toLowerCase(), t.id]));
        const rows = records.map((record, index) => this.validateRow(record, index + 1, { cattleByTag, tankByName }));
        const importSessionId = (0, node_crypto_1.randomUUID)();
        await this.cache.set(this.sessionKey(farmId, importSessionId), { rows }, SESSION_TTL_SECONDS);
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
        const groups = new Map();
        for (const row of ready) {
            for (const [session, yieldL] of Object.entries(row.data.sessions)) {
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
            }
            catch (error) {
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
    validateRow(record, rowNumber, ctx) {
        const read = (header) => {
            const value = record[header];
            return typeof value === 'string' && value.trim() ? value.trim() : null;
        };
        const dateRaw = read('date');
        const tag = read('cow tag') ?? read('cow id') ?? read('tag');
        const base = {
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
        const sessions = {};
        for (const [header, session] of Object.entries(SESSION_COLUMNS)) {
            const raw = read(header);
            if (!raw)
                continue;
            const value = Number(raw);
            if (!Number.isFinite(value) || value < 0 || value > 100) {
                return { ...base, date, error: `Invalid ${header} yield: "${raw}" (must be between 0 and 100 L)` };
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
        let tankId = null;
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
    sessionKey(farmId, sessionId) {
        return `milk:import:${farmId}:${sessionId}`;
    }
};
exports.MilkImportService = MilkImportService;
exports.MilkImportService = MilkImportService = MilkImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        milk_service_1.MilkService,
        logger_service_1.LoggerService])
], MilkImportService);
//# sourceMappingURL=milk-import.service.js.map