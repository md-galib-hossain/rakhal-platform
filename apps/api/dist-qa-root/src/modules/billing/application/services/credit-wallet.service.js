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
exports.CreditWalletService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const credit_policy_1 = require("../../domain/credit-policy");
let CreditWalletService = class CreditWalletService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getBalance(farmId, db = this.prisma) {
        const wallet = await db.creditWallet.findUnique({ where: { farmId } });
        return wallet?.balance ?? new client_1.Prisma.Decimal(0);
    }
    async credit(farmId, amount, db = this.prisma) {
        if (amount.lte(0))
            return;
        await db.creditWallet.upsert({
            where: { farmId },
            create: { farmId, balance: amount },
            update: { balance: { increment: amount } },
        });
    }
    async debit(farmId, amount, opts = {}) {
        const db = opts.db ?? this.prisma;
        if (amount.lte(0))
            return;
        await db.creditWallet.update({
            where: { farmId },
            data: { balance: { decrement: amount } },
        });
    }
    async applyToCharge(tx, farmId, remaining, surface = 'subscription') {
        if (!credit_policy_1.DEFAULT_CREDIT_POLICY.spendableSurfaces.includes(surface)) {
            throw new common_1.ForbiddenException(`Rakhal Credit cannot yet be spent on "${surface}"`);
        }
        const wallet = await tx.creditWallet.findUnique({ where: { farmId } });
        if (!wallet || wallet.balance.lte(0) || remaining.lte(0)) {
            return new client_1.Prisma.Decimal(0);
        }
        const applied = wallet.balance.gt(remaining) ? remaining : wallet.balance;
        await tx.creditWallet.update({
            where: { farmId },
            data: { balance: { decrement: applied } },
        });
        return applied;
    }
    assertCashOutEnabled() {
        if (!credit_policy_1.DEFAULT_CREDIT_POLICY.cashOutEnabled) {
            throw new common_1.ForbiddenException('Rakhal Credit is store credit and cannot be withdrawn as cash');
        }
    }
};
exports.CreditWalletService = CreditWalletService;
exports.CreditWalletService = CreditWalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CreditWalletService);
//# sourceMappingURL=credit-wallet.service.js.map