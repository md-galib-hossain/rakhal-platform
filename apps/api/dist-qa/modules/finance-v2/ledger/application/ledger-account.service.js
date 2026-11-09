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
var LedgerAccountService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerAccountService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const default_chart_of_accounts_1 = require("../domain/default-chart-of-accounts");
let LedgerAccountService = LedgerAccountService_1 = class LedgerAccountService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(LedgerAccountService_1.name);
    }
    async seedDefaultChart(farmId, tx) {
        const client = tx ?? this.prisma;
        const result = await client.ledgerAccount.createMany({
            data: default_chart_of_accounts_1.DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
                farmId,
                category: account.category,
                code: account.code,
                name: account.name,
                isSystem: true,
            })),
            skipDuplicates: true,
        });
        this.log.info('Default chart of accounts seeded', {
            farmId,
            created: result.count,
        });
    }
    async findAll(farmId) {
        return this.prisma.ledgerAccount.findMany({
            where: { farmId },
            orderBy: { code: 'asc' },
        });
    }
    async findByCode(farmId, code, tx) {
        const client = tx ?? this.prisma;
        return client.ledgerAccount.findUnique({
            where: { farmId_code: { farmId, code } },
        });
    }
    async findByCodeOrSeed(farmId, code, tx) {
        const found = await this.findByCode(farmId, code, tx);
        if (found)
            return found;
        await this.seedDefaultChart(farmId, tx);
        return this.findByCode(farmId, code, tx);
    }
};
exports.LedgerAccountService = LedgerAccountService;
exports.LedgerAccountService = LedgerAccountService = LedgerAccountService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], LedgerAccountService);
//# sourceMappingURL=ledger-account.service.js.map