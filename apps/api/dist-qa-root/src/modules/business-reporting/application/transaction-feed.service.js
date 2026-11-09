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
exports.TransactionFeedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const money_1 = require("src/common/money");
const pagination_1 = require("src/common/pagination");
const transaction_source_1 = require("../domain/transaction-source");
let TransactionFeedService = class TransactionFeedService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listTransactions(farmId, query) {
        let ledgerAccountIdFilter;
        if (query.financialAccountId) {
            const account = await this.prisma.financialAccount.findFirst({
                where: { id: query.financialAccountId, farmId },
                select: { ledgerAccountId: true },
            });
            if (!account) {
                return {
                    items: [],
                    meta: {
                        count: 0,
                        limit: query.limit,
                        hasNextPage: false,
                        hasPreviousPage: Boolean(query.cursor),
                        startCursor: null,
                        endCursor: null,
                    },
                };
            }
            ledgerAccountIdFilter = account.ledgerAccountId;
        }
        const where = {
            farmId,
            ...(query.type ? { sourceType: query.type } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.from || query.to
                ? {
                    transactionDate: {
                        ...(query.from ? { gte: new Date(query.from) } : {}),
                        ...(query.to ? { lte: new Date(query.to) } : {}),
                    },
                }
                : {}),
            ...(ledgerAccountIdFilter
                ? { entries: { some: { ledgerAccountId: ledgerAccountIdFilter } } }
                : {}),
        };
        const rows = await this.prisma.journalTransaction.findMany({
            where,
            orderBy: [{ transactionDate: query.sortOrder }, { id: query.sortOrder }],
            ...(0, pagination_1.getCursorArgs)(query),
        });
        const page = (0, pagination_1.toCursorPage)(rows, query);
        if (page.items.length === 0) {
            return { items: [], meta: page.meta };
        }
        const txnIds = page.items.map((t) => t.id);
        const [entries, financialAccounts, resolutions, users] = await Promise.all([
            this.prisma.journalEntry.findMany({
                where: { journalTransactionId: { in: txnIds } },
                select: {
                    journalTransactionId: true,
                    ledgerAccountId: true,
                    debit: true,
                    credit: true,
                },
            }),
            this.prisma.financialAccount.findMany({
                where: { farmId },
                select: { name: true, ledgerAccountId: true },
            }),
            this.resolveParties(page.items),
            this.prisma.user.findMany({
                where: {
                    id: { in: [...new Set(page.items.map((t) => t.createdById))] },
                },
                select: { id: true, name: true },
            }),
        ]);
        const accountNameByLedgerId = new Map(financialAccounts.map((a) => [a.ledgerAccountId, a.name]));
        const userNameById = new Map(users.map((u) => [u.id, u.name]));
        const amountByTxn = new Map();
        const cashDebitByTxn = new Map();
        const cashCreditByTxn = new Map();
        const accountsByTxn = new Map();
        for (const id of txnIds) {
            amountByTxn.set(id, (0, money_1.toStorage)(0));
            cashDebitByTxn.set(id, (0, money_1.toStorage)(0));
            cashCreditByTxn.set(id, (0, money_1.toStorage)(0));
            accountsByTxn.set(id, new Set());
        }
        for (const e of entries) {
            amountByTxn.set(e.journalTransactionId, (0, money_1.add)(amountByTxn.get(e.journalTransactionId), e.debit));
            const accountName = accountNameByLedgerId.get(e.ledgerAccountId);
            if (accountName) {
                cashDebitByTxn.set(e.journalTransactionId, (0, money_1.add)(cashDebitByTxn.get(e.journalTransactionId), e.debit));
                cashCreditByTxn.set(e.journalTransactionId, (0, money_1.add)(cashCreditByTxn.get(e.journalTransactionId), e.credit));
                accountsByTxn.get(e.journalTransactionId).add(accountName);
            }
        }
        const items = page.items.map((t) => {
            const descriptor = (0, transaction_source_1.describeSourceType)(t.sourceType);
            const resolution = resolutions.get(`${t.sourceType}:${t.sourceId}`) ?? {
                reference: null,
                party: null,
            };
            return {
                id: t.id,
                transactionDate: t.transactionDate.toISOString(),
                type: t.sourceType,
                typeLabel: descriptor.label,
                reference: resolution.reference,
                party: resolution.party,
                accounts: [...(accountsByTxn.get(t.id) ?? [])],
                amount: amountByTxn.get(t.id).toString(),
                cashAmount: (0, money_1.subtract)(cashDebitByTxn.get(t.id), cashCreditByTxn.get(t.id)).toString(),
                status: t.status,
                createdBy: userNameById.get(t.createdById) ?? null,
                source: {
                    type: t.sourceType,
                    id: t.sourceId,
                    label: descriptor.label,
                    href: descriptor.buildHref(t.sourceId),
                },
            };
        });
        return { items, meta: page.meta };
    }
    async resolveParties(txns) {
        const idsByType = new Map();
        for (const t of txns) {
            if (transaction_source_1.PARTY_RESOLVABLE_SOURCE_TYPES.includes(t.sourceType)) {
                idsByType.set(t.sourceType, [
                    ...(idsByType.get(t.sourceType) ?? []),
                    t.sourceId,
                ]);
            }
        }
        const result = new Map();
        const saleIds = idsByType.get('SALE');
        if (saleIds?.length) {
            const sales = await this.prisma.sale.findMany({
                where: { id: { in: saleIds } },
                select: {
                    id: true,
                    saleNumber: true,
                    customer: { select: { id: true, name: true } },
                },
            });
            for (const s of sales) {
                result.set(`SALE:${s.id}`, {
                    reference: s.saleNumber,
                    party: s.customer,
                });
            }
        }
        const purchaseIds = idsByType.get('PURCHASE');
        if (purchaseIds?.length) {
            const purchases = await this.prisma.purchase.findMany({
                where: { id: { in: purchaseIds } },
                select: {
                    id: true,
                    purchaseNumber: true,
                    supplier: { select: { id: true, name: true } },
                },
            });
            for (const p of purchases) {
                result.set(`PURCHASE:${p.id}`, {
                    reference: p.purchaseNumber,
                    party: p.supplier,
                });
            }
        }
        const expenseIds = idsByType.get('EXPENSE');
        if (expenseIds?.length) {
            const expenses = await this.prisma.expense.findMany({
                where: { id: { in: expenseIds } },
                select: {
                    id: true,
                    description: true,
                    supplier: { select: { id: true, name: true } },
                },
            });
            for (const e of expenses) {
                result.set(`EXPENSE:${e.id}`, {
                    reference: e.description,
                    party: e.supplier,
                });
            }
        }
        return result;
    }
};
exports.TransactionFeedService = TransactionFeedService;
exports.TransactionFeedService = TransactionFeedService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TransactionFeedService);
//# sourceMappingURL=transaction-feed.service.js.map