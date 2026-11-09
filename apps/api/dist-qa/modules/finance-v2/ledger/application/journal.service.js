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
var JournalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const journal_balance_1 = require("../domain/journal-balance");
let JournalService = JournalService_1 = class JournalService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(JournalService_1.name);
    }
    async postJournal(input, tx) {
        (0, journal_balance_1.assertBalanced)(input.entries);
        if (tx) {
            return this.postWithClient(tx, input);
        }
        return this.prisma.$transaction((t) => this.postWithClient(t, input));
    }
    async postWithClient(client, input) {
        const existing = await client.journalTransaction.findUnique({
            where: {
                farmId_idempotencyKey: {
                    farmId: input.farmId,
                    idempotencyKey: input.idempotencyKey,
                },
            },
            include: { entries: true },
        });
        if (existing) {
            this.log.info('Journal posting replayed — idempotent no-op', {
                farmId: input.farmId,
                idempotencyKey: input.idempotencyKey,
                journalTransactionId: existing.id,
            });
            return existing;
        }
        const created = await client.journalTransaction.create({
            data: {
                farmId: input.farmId,
                sourceType: input.sourceType,
                sourceId: input.sourceId,
                transactionDate: input.transactionDate,
                description: input.description,
                status: client_1.JournalTransactionStatus.POSTED,
                idempotencyKey: input.idempotencyKey,
                createdById: input.createdById,
                entries: {
                    create: input.entries.map((entry) => ({
                        ledgerAccountId: entry.ledgerAccountId,
                        debit: (0, money_1.toStorage)(entry.debit ?? 0),
                        credit: (0, money_1.toStorage)(entry.credit ?? 0),
                    })),
                },
            },
            include: { entries: true },
        });
        this.log.info('Journal transaction posted', {
            farmId: input.farmId,
            journalTransactionId: created.id,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            lines: created.entries.length,
        });
        return created;
    }
    async reverseJournal(input, tx) {
        if (tx) {
            return this.reverseWithClient(tx, input);
        }
        return this.prisma.$transaction((t) => this.reverseWithClient(t, input));
    }
    async reverseWithClient(client, input) {
        const existingReversal = await client.journalTransaction.findUnique({
            where: {
                farmId_idempotencyKey: {
                    farmId: input.farmId,
                    idempotencyKey: input.idempotencyKey,
                },
            },
            include: { entries: true },
        });
        if (existingReversal) {
            this.log.info('Journal reversal replayed — idempotent no-op', {
                farmId: input.farmId,
                idempotencyKey: input.idempotencyKey,
                journalTransactionId: existingReversal.id,
            });
            return existingReversal;
        }
        const original = await client.journalTransaction.findFirst({
            where: { id: input.journalTransactionId, farmId: input.farmId },
            include: { entries: true },
        });
        if (!original) {
            throw new journal_balance_1.JournalNotFoundError(input.journalTransactionId);
        }
        const alreadyReversed = await client.journalTransaction.findFirst({
            where: { reversalOfId: original.id, farmId: input.farmId },
            select: { id: true },
        });
        if (alreadyReversed) {
            throw new journal_balance_1.JournalAlreadyReversedError(original.id);
        }
        const mirroredEntries = (0, journal_balance_1.mirrorForReversal)(original.entries.map((entry) => ({
            ledgerAccountId: entry.ledgerAccountId,
            debit: entry.debit,
            credit: entry.credit,
        })));
        (0, journal_balance_1.assertBalanced)(mirroredEntries);
        const reversal = await client.journalTransaction.create({
            data: {
                farmId: input.farmId,
                sourceType: original.sourceType,
                sourceId: original.sourceId,
                transactionDate: input.transactionDate ?? new Date(),
                description: input.description ?? `Reversal of: ${original.description}`,
                status: client_1.JournalTransactionStatus.REVERSED,
                reversalOfId: original.id,
                idempotencyKey: input.idempotencyKey,
                createdById: input.createdById,
                entries: {
                    create: mirroredEntries.map((entry) => ({
                        ledgerAccountId: entry.ledgerAccountId,
                        debit: (0, money_1.toStorage)(entry.debit ?? 0),
                        credit: (0, money_1.toStorage)(entry.credit ?? 0),
                    })),
                },
            },
            include: { entries: true },
        });
        this.log.info('Journal transaction reversed', {
            farmId: input.farmId,
            originalJournalTransactionId: original.id,
            reversalJournalTransactionId: reversal.id,
        });
        return reversal;
    }
    async findById(farmId, journalTransactionId) {
        return this.prisma.journalTransaction.findFirst({
            where: { id: journalTransactionId, farmId },
            include: { entries: true },
        });
    }
};
exports.JournalService = JournalService;
exports.JournalService = JournalService = JournalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], JournalService);
//# sourceMappingURL=journal.service.js.map