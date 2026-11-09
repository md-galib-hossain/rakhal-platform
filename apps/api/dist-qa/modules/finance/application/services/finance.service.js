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
var FinanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const balance_service_1 = require("src/modules/finance-v2/accounts/application/balance.service");
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(n * 100) / 100;
let FinanceService = FinanceService_1 = class FinanceService {
    prisma;
    balanceService;
    log;
    constructor(prisma, balanceService, logger) {
        this.prisma = prisma;
        this.balanceService = balanceService;
        this.log = logger.setContext(FinanceService_1.name);
    }
    async liabilities(farmId) {
        const loans = await this.prisma.financeLoan.findMany({
            where: { farmId },
            orderBy: { createdAt: 'desc' },
        });
        const active = loans.filter((l) => l.status === client_1.LoanStatus.ACTIVE);
        return {
            stats: {
                totalDebt: round2(active.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0)),
                monthlyEmi: round2(active.reduce((s, l) => s + l.monthlyEmi, 0)),
            },
            loans: loans.map((l) => ({
                id: l.id,
                entityName: l.lenderName,
                total: l.totalAmount,
                paid: l.paidAmount,
                outstanding: round2(l.totalAmount - l.paidAmount),
                monthlyEmi: l.monthlyEmi,
                status: l.status,
            })),
        };
    }
    async assets(farmId) {
        const [medicines, feedItems, equipmentInv, fixedAssets, rakhalBalance, loans,] = await Promise.all([
            this.prisma.medicine.findMany({
                where: { farmId, deletedAt: null },
                select: { currentStock: true, costPerUnit: true },
            }),
            this.prisma.feedItemBatch.findMany({
                where: { farmId, deletedAt: null, feedItem: { deletedAt: null } },
                select: { currentStock: true, costPerUnit: true },
            }),
            this.prisma.equipment.findMany({
                where: { farmId, deletedAt: null },
                select: { currentStock: true, costPerUnit: true },
            }),
            this.prisma.fixedAsset.findMany({
                where: { farmId, deletedAt: null },
                select: {
                    name: true,
                    category: true,
                    purchaseDate: true,
                    purchasePrice: true,
                    usefulLifeYears: true,
                    salvageValue: true,
                },
            }),
            this.balanceService.getRakhalBalance(farmId),
            this.prisma.financeLoan.findMany({
                where: { farmId, status: client_1.LoanStatus.ACTIVE },
                select: { totalAmount: true, paidAmount: true },
            }),
        ]);
        const liquidity = Number(rakhalBalance.rakhalBalance);
        const inventoryValue = round2(medicines.reduce((s, m) => s + m.currentStock * m.costPerUnit, 0) +
            feedItems.reduce((s, f) => s + f.currentStock * f.costPerUnit, 0) +
            equipmentInv.reduce((s, e) => s + e.currentStock * e.costPerUnit, 0));
        const now = new Date();
        let equipmentBookValue = 0;
        let landStructureBookValue = 0;
        const depreciation = [];
        for (const asset of fixedAssets) {
            const yearsElapsed = (now.getTime() - asset.purchaseDate.getTime()) / (365.25 * DAY_MS);
            const annualDepreciation = (asset.purchasePrice - asset.salvageValue) / asset.usefulLifeYears;
            const accumulated = round2(Math.min(annualDepreciation * yearsElapsed, asset.purchasePrice - asset.salvageValue));
            const bookValue = round2(asset.purchasePrice - accumulated);
            depreciation.push({
                asset_name: asset.name,
                book_value: bookValue,
                accumulated_depreciation: accumulated,
                useful_life_years: asset.usefulLifeYears,
                purchase_value: asset.purchasePrice,
            });
            if (asset.category === client_1.FixedAssetCategory.BUILDING) {
                landStructureBookValue = round2(landStructureBookValue + bookValue);
            }
            else {
                equipmentBookValue = round2(equipmentBookValue + bookValue);
            }
        }
        const cattleHerdValue = 0;
        const totalLiabilities = round2(loans.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0));
        const allocation = [
            { category: 'cattle_herd', value: cattleHerdValue, color: '#1A7A4A' },
            { category: 'equipment', value: equipmentBookValue, color: '#2563EB' },
            {
                category: 'land_structure',
                value: landStructureBookValue,
                color: '#D97706',
            },
            { category: 'inventory', value: inventoryValue, color: '#7C3AED' },
            { category: 'cash_bank', value: round2(liquidity), color: '#DC2626' },
        ];
        const totalAssets = round2(allocation.reduce((s, a) => s + a.value, 0));
        return {
            allocation,
            totalAssets,
            totalLiabilities,
            totalNetWorth: round2(totalAssets - totalLiabilities),
            depreciation,
        };
    }
    async createFixedAsset(farmId, userId, dto) {
        const asset = await this.prisma.fixedAsset.create({
            data: {
                farmId,
                name: dto.name,
                category: dto.category ?? client_1.FixedAssetCategory.EQUIPMENT,
                description: dto.description,
                purchaseDate: new Date(dto.purchaseDate),
                purchasePrice: dto.purchasePrice,
                usefulLifeYears: dto.usefulLifeYears ?? 5,
                salvageValue: dto.salvageValue ?? 0,
                createdBy: userId,
            },
        });
        this.log.info('Fixed asset created', { assetId: asset.id, farmId });
        return { assetId: asset.id, name: asset.name, category: asset.category };
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = FinanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        balance_service_1.BalanceService,
        logger_service_1.LoggerService])
], FinanceService);
//# sourceMappingURL=finance.service.js.map