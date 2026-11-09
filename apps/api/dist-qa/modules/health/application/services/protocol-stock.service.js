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
exports.ProtocolStockService = exports.PROTOCOL_OUT_OF_STOCK = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const unit_conversion_1 = require("src/modules/inventory/domain/unit-conversion");
exports.PROTOCOL_OUT_OF_STOCK = 'PROTOCOL_OUT_OF_STOCK';
const toUnitLike = (u) => ({
    id: u.id,
    symbol: u.symbol,
    dimension: u.dimension,
    conversionToBase: u.conversionToBase,
});
let ProtocolStockService = class ProtocolStockService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async validateAndNormalizeSteps(farmId, steps) {
        const medSteps = steps.filter((s) => s.actionType === client_1.HealthActionType.MEDICINE);
        if (medSteps.length === 0)
            return steps;
        for (const [i, s] of medSteps.entries()) {
            if (!s.medicineId) {
                throw new common_1.BadRequestException(`Medicine step ${i + 1}: pick a medicine from inventory`);
            }
            if (!(Number(s.doseAmount) > 0)) {
                throw new common_1.BadRequestException(`Medicine step ${i + 1}: dose must be greater than 0`);
            }
            if (!s.doseUnitId) {
                throw new common_1.BadRequestException(`Medicine step ${i + 1}: pick a dose unit`);
            }
        }
        const medicines = await this.prisma.medicine.findMany({
            where: {
                farmId,
                deletedAt: null,
                id: { in: [...new Set(medSteps.map((s) => s.medicineId))] },
            },
            include: { unit: true },
        });
        const medById = new Map(medicines.map((m) => [m.id, m]));
        const doseUnits = await this.prisma.unit.findMany({
            where: {
                deletedAt: null,
                id: { in: [...new Set(medSteps.map((s) => s.doseUnitId))] },
                OR: [{ farmId: null }, { farmId }],
            },
        });
        const unitById = new Map(doseUnits.map((u) => [u.id, u]));
        return steps.map((s) => {
            if (s.actionType !== client_1.HealthActionType.MEDICINE)
                return s;
            const med = medById.get(s.medicineId);
            if (!med) {
                throw new common_1.BadRequestException(`Medicine "${s.medicineName ?? s.medicineId}" was not found in inventory`);
            }
            const doseUnit = unitById.get(s.doseUnitId);
            if (!doseUnit) {
                throw new common_1.BadRequestException(`Dose unit for "${med.name}" was not found`);
            }
            if (!(0, unit_conversion_1.unitsCompatible)(toUnitLike(doseUnit), toUnitLike(med.unit))) {
                throw new common_1.BadRequestException(`Dose unit ${doseUnit.symbol} cannot be converted to ${med.name}'s stock unit ${med.unit.symbol}`);
            }
            return { ...s, medicineName: med.name, doseUnit: doseUnit.symbol };
        });
    }
    async check(farmId, steps, animalCount) {
        const medSteps = steps.filter((s) => s.actionType === client_1.HealthActionType.MEDICINE &&
            (s.medicineId || s.medicineName));
        if (medSteps.length === 0 || animalCount <= 0)
            return [];
        const ids = [
            ...new Set(medSteps.map((s) => s.medicineId).filter(Boolean)),
        ];
        const names = [
            ...new Set(medSteps
                .filter((s) => !s.medicineId && s.medicineName)
                .map((s) => s.medicineName.toLowerCase())),
        ];
        const medicines = await this.prisma.medicine.findMany({
            where: {
                farmId,
                deletedAt: null,
                OR: [
                    ...(ids.length ? [{ id: { in: ids } }] : []),
                    ...names.map((n) => ({
                        name: { equals: n, mode: 'insensitive' },
                    })),
                ],
            },
            include: {
                unit: true,
                batches: {
                    where: { deletedAt: null },
                    select: { currentStock: true, expiryDate: true },
                },
            },
        });
        const doseUnitIds = [
            ...new Set(medSteps.map((s) => s.doseUnitId).filter(Boolean)),
        ];
        const doseUnits = doseUnitIds.length
            ? await this.prisma.unit.findMany({ where: { id: { in: doseUnitIds } } })
            : [];
        const unitById = new Map(doseUnits.map((u) => [u.id, u]));
        const need = new Map();
        for (const s of medSteps) {
            const rows = s.medicineId
                ? medicines.filter((m) => m.id === s.medicineId)
                : medicines.filter((m) => m.name.toLowerCase() === s.medicineName.toLowerCase());
            const key = s.medicineId ?? `name:${s.medicineName.toLowerCase()}`;
            const medUnit = rows[0] ? toUnitLike(rows[0].unit) : null;
            const doseU = s.doseUnitId ? unitById.get(s.doseUnitId) : undefined;
            let perAnimal = Number(s.doseAmount ?? 0);
            if (medUnit && doseU) {
                try {
                    perAnimal = (0, unit_conversion_1.convertQuantity)(perAnimal, toUnitLike(doseU), medUnit);
                }
                catch {
                }
            }
            const entry = need.get(key) ?? {
                medicineIds: rows.map((m) => m.id),
                name: rows[0]?.name ?? s.medicineName ?? 'Unknown medicine',
                needed: 0,
                unit: rows[0]?.unit.symbol ?? doseU?.symbol ?? '',
            };
            entry.needed += perAnimal * animalCount;
            need.set(key, entry);
        }
        const shortfalls = [];
        for (const [key, n] of need) {
            const rows = medicines.filter((m) => n.medicineIds.includes(m.id));
            const now = new Date();
            const available = rows.reduce((sum, m) => {
                if (m.batches.length === 0) {
                    return m.expiryDate > now ? sum + m.currentStock : sum;
                }
                return (sum +
                    m.batches.reduce((b, x) => x.expiryDate > now ? b + Math.max(0, x.currentStock) : b, 0));
            }, 0);
            if (available <= 0 || n.needed > available + 1e-9) {
                shortfalls.push({
                    medicineId: key.startsWith('name:') ? null : key,
                    medicineName: n.name,
                    needed: Math.round(n.needed * 1e6) / 1e6,
                    available: Math.round(available * 1e6) / 1e6,
                    unit: n.unit,
                });
            }
        }
        return shortfalls;
    }
    async assertInStock(farmId, steps, animalCount) {
        const shortfalls = await this.check(farmId, steps, animalCount);
        if (shortfalls.length === 0)
            return;
        throw new common_1.ConflictException({
            details: { reason: exports.PROTOCOL_OUT_OF_STOCK, shortfalls },
            message: `Not enough stock: ${shortfalls
                .map((s) => `${s.medicineName} (need ${s.needed} ${s.unit}, have ${s.available} ${s.unit})`)
                .join('; ')}`,
        });
    }
};
exports.ProtocolStockService = ProtocolStockService;
exports.ProtocolStockService = ProtocolStockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProtocolStockService);
//# sourceMappingURL=protocol-stock.service.js.map