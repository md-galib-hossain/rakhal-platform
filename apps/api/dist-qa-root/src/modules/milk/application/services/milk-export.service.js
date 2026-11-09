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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilkExportService = void 0;
const common_1 = require("@nestjs/common");
const exceljs_1 = require("exceljs");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
let MilkExportService = class MilkExportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async exportLog(farmId, dto) {
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
        const rows = new Map();
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
        const workbook = new exceljs_1.Workbook();
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
        for (const row of [...rows.values()].sort((a, b) => a.date.localeCompare(b.date) || a.tag.localeCompare(b.tag))) {
            const morning = row.sessions[client_1.MilkSession.MORNING] ?? null;
            const noon = row.sessions[client_1.MilkSession.NOON] ?? null;
            const evening = row.sessions[client_1.MilkSession.EVENING] ?? null;
            const night = row.sessions[client_1.MilkSession.NIGHT] ?? null;
            const total = [morning, noon, evening, night]
                .filter((v) => v !== null)
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
        const buffer = (await workbook.xlsx.writeBuffer());
        const filename = `milk-log_${dto.from}_${dto.to}.xlsx`;
        return { buffer, filename };
    }
    normalizeDate(dateStr) {
        return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`);
    }
};
exports.MilkExportService = MilkExportService;
exports.MilkExportService = MilkExportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MilkExportService);
//# sourceMappingURL=milk-export.service.js.map