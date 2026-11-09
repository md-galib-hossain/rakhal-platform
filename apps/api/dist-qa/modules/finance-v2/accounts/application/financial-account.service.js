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
var FinancialAccountService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialAccountService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const ledger_account_service_1 = require("src/modules/finance-v2/ledger/application/ledger-account.service");
const journal_service_1 = require("src/modules/finance-v2/ledger/application/journal.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const OPENING_BALANCE_EQUITY_CODE = '3000';
const OPENING_BALANCE_SOURCE_TYPE = 'FINANCIAL_ACCOUNT_OPENING_BALANCE';
const CUSTOM_LEDGER_CODE_START = 9000;
const CUSTOM_LEDGER_CODE_MAX = 9999999;
const DETAIL_INCLUDE = { bankDetail: true, mfsDetail: true };
let FinancialAccountService = FinancialAccountService_1 = class FinancialAccountService {
    prisma;
    ledgerAccountService;
    journalService;
    activityLog;
    log;
    constructor(prisma, ledgerAccountService, journalService, activityLog, logger) {
        this.prisma = prisma;
        this.ledgerAccountService = ledgerAccountService;
        this.journalService = journalService;
        this.activityLog = activityLog;
        this.log = logger.setContext(FinancialAccountService_1.name);
    }
    async createAccount(farmId, userId, dto, tx) {
        const run = (client) => this.createWithClient(client, farmId, userId, dto);
        if (!tx) {
            const account = await this.prisma.$transaction((t) => run(t));
            await this.activityLog.record({
                farmId,
                module: client_1.ActivityLogModule.FINANCE,
                eventTitle: 'Financial Account Created',
                actionDetails: `${account.type} account "${account.name}" created${dto.openingBalance ? ` with ৳${dto.openingBalance} opening balance` : ''}.`,
                actorId: userId,
            });
            return account;
        }
        return run(tx);
    }
    async createWithClient(client, farmId, userId, dto) {
        if (dto.type === client_1.FinancialAccountType.BANK && !dto.bankDetail) {
            throw new common_1.BadRequestException('bankDetail is required for a BANK account');
        }
        if (dto.type === client_1.FinancialAccountType.MFS && !dto.mfsDetail) {
            throw new common_1.BadRequestException('mfsDetail is required for an MFS account');
        }
        await client.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`finance-v2-account:${farmId}`}))`;
        const liveAccount = await client.financialAccount.findFirst({
            where: { farmId, deletedAt: null },
            select: { id: true },
        });
        if (liveAccount) {
            throw new common_1.ConflictException('This farm already has a financial account; only one is allowed');
        }
        const code = await this.nextCustomLedgerCode(client, farmId);
        const ledgerAccount = await client.ledgerAccount.create({
            data: {
                farmId,
                category: client_1.LedgerAccountCategory.ASSET,
                code,
                name: dto.name,
                isSystem: false,
            },
        });
        const account = await client.financialAccount.create({
            data: {
                farmId,
                name: dto.name,
                type: dto.type,
                ledgerAccountId: ledgerAccount.id,
                currency: dto.currency ?? 'BDT',
                isPrimary: true,
                createdById: userId,
            },
        });
        let bankDetail = null;
        let mfsDetail = null;
        if (dto.type === client_1.FinancialAccountType.BANK && dto.bankDetail) {
            bankDetail = await client.bankAccountDetail.create({
                data: {
                    financialAccountId: account.id,
                    bankName: dto.bankDetail.bankName,
                    accountNumber: dto.bankDetail.accountNumber,
                    branch: dto.bankDetail.branch,
                },
            });
        }
        else if (dto.type === client_1.FinancialAccountType.MFS && dto.mfsDetail) {
            mfsDetail = await client.mfsAccountDetail.create({
                data: {
                    financialAccountId: account.id,
                    provider: dto.mfsDetail.provider,
                    phoneNumber: dto.mfsDetail.phoneNumber,
                    accountType: dto.mfsDetail.accountType,
                },
            });
        }
        if (dto.openingBalance !== undefined && !(0, money_1.isZero)(dto.openingBalance)) {
            await this.postOpeningBalance(client, {
                farmId,
                userId,
                accountId: account.id,
                accountName: dto.name,
                ledgerAccountId: ledgerAccount.id,
                amount: dto.openingBalance,
                idempotencyKey: `financial-account-opening-balance:${account.id}`,
            });
        }
        this.log.info('Financial account created', {
            farmId,
            financialAccountId: account.id,
            type: account.type,
            ledgerAccountId: ledgerAccount.id,
            openingBalance: dto.openingBalance ?? 0,
        });
        return { ...account, bankDetail, mfsDetail };
    }
    async postOpeningBalance(client, p) {
        const openingBalance = (0, money_1.toStorage)(p.amount);
        let equityAccount = await this.ledgerAccountService.findByCode(p.farmId, OPENING_BALANCE_EQUITY_CODE, client);
        if (!equityAccount) {
            await this.ledgerAccountService.seedDefaultChart(p.farmId, client);
            equityAccount = await this.ledgerAccountService.findByCode(p.farmId, OPENING_BALANCE_EQUITY_CODE, client);
        }
        if (!equityAccount) {
            throw new common_1.BadRequestException('Opening Balance Equity ledger account is not seeded for this farm');
        }
        await this.journalService.postJournal({
            farmId: p.farmId,
            sourceType: OPENING_BALANCE_SOURCE_TYPE,
            sourceId: p.accountId,
            transactionDate: new Date(),
            description: `Opening balance for ${p.accountName}`,
            idempotencyKey: p.idempotencyKey,
            createdById: p.userId,
            entries: [
                { ledgerAccountId: p.ledgerAccountId, debit: openingBalance },
                { ledgerAccountId: equityAccount.id, credit: openingBalance },
            ],
        }, client);
    }
    async setOpeningBalance(farmId, id, userId, amount) {
        await this.assertAccountActive(farmId, id);
        const account = await this.prisma.$transaction(async (tx) => {
            const acct = await tx.financialAccount.findFirstOrThrow({
                where: { id, farmId },
                include: DETAIL_INCLUDE,
            });
            const postings = await tx.journalTransaction.findMany({
                where: {
                    farmId,
                    sourceType: OPENING_BALANCE_SOURCE_TYPE,
                    sourceId: id,
                    reversalOfId: null,
                },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                select: { id: true },
            });
            for (const posting of postings) {
                const reversed = await tx.journalTransaction.findFirst({
                    where: { farmId, reversalOfId: posting.id },
                    select: { id: true },
                });
                if (reversed)
                    continue;
                await this.journalService.reverseJournal({
                    farmId,
                    journalTransactionId: posting.id,
                    createdById: userId,
                    idempotencyKey: `financial-account-opening-balance-reversal:${posting.id}`,
                    description: `Opening balance corrected for ${acct.name}`,
                }, tx);
            }
            if (!(0, money_1.isZero)(amount)) {
                await this.postOpeningBalance(tx, {
                    farmId,
                    userId,
                    accountId: id,
                    accountName: acct.name,
                    ledgerAccountId: acct.ledgerAccountId,
                    amount,
                    idempotencyKey: `financial-account-opening-balance:${id}:${postings.length}`,
                });
            }
            return acct;
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Opening Balance Updated',
            actionDetails: `Opening balance of "${account.name}" set to ৳${amount}.`,
            actorId: userId,
            taggedValues: [{ key: 'sensitive', value: 'opening-balance-changed' }],
        });
        return account;
    }
    async resolveFarmAccount(farmId, userId, tx) {
        const client = tx ?? this.prisma;
        const find = () => client.financialAccount.findFirst({
            where: { farmId, deletedAt: null },
            include: DETAIL_INCLUDE,
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        const existing = await find();
        if (existing)
            return existing;
        try {
            return await this.createAccount(farmId, userId, { name: 'Main Wallet', type: client_1.FinancialAccountType.CASH }, tx);
        }
        catch (err) {
            if (tx)
                throw err;
            const winner = await find();
            if (winner)
                return winner;
            throw err;
        }
    }
    async resolveFarmAccountId(farmId, userId, provided, tx) {
        if (provided)
            return provided;
        return (await this.resolveFarmAccount(farmId, userId, tx)).id;
    }
    async findAll(farmId, includeArchived = false) {
        return this.prisma.financialAccount.findMany({
            where: { farmId, ...(includeArchived ? {} : { deletedAt: null }) },
            include: DETAIL_INCLUDE,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
    }
    async findOne(farmId, id) {
        return this.getOrThrow(farmId, id);
    }
    async updateAccount(farmId, id, dto) {
        const existing = await this.getOrThrow(farmId, id);
        if (dto.bankDetail && existing.type !== client_1.FinancialAccountType.BANK) {
            throw new common_1.BadRequestException('bankDetail can only be updated on a BANK account');
        }
        if (dto.mfsDetail && existing.type !== client_1.FinancialAccountType.MFS) {
            throw new common_1.BadRequestException('mfsDetail can only be updated on an MFS account');
        }
        if (dto.name !== undefined) {
            await this.prisma.financialAccount.update({
                where: { id },
                data: { name: dto.name },
            });
        }
        if (dto.bankDetail) {
            await this.prisma.bankAccountDetail.update({
                where: { financialAccountId: id },
                data: {
                    bankName: dto.bankDetail.bankName,
                    accountNumber: dto.bankDetail.accountNumber,
                    branch: dto.bankDetail.branch,
                },
            });
        }
        if (dto.mfsDetail) {
            await this.prisma.mfsAccountDetail.update({
                where: { financialAccountId: id },
                data: {
                    provider: dto.mfsDetail.provider,
                    phoneNumber: dto.mfsDetail.phoneNumber,
                    accountType: dto.mfsDetail.accountType,
                },
            });
        }
        this.log.info('Financial account updated', {
            farmId,
            financialAccountId: id,
        });
        return this.getOrThrow(farmId, id);
    }
    async setPrimary(farmId, id, userId) {
        await this.assertAccountActive(farmId, id);
        const account = await this.prisma.$transaction(async (tx) => {
            await tx.financialAccount.updateMany({
                where: { farmId, isPrimary: true },
                data: { isPrimary: false },
            });
            return tx.financialAccount.update({
                where: { id },
                data: { isPrimary: true },
                include: DETAIL_INCLUDE,
            });
        });
        this.log.info('Primary financial account set', {
            farmId,
            financialAccountId: id,
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Primary Financial Account Set',
            actionDetails: `${account.type} account "${account.name}" set as the primary wallet.`,
            actorId: userId ?? null,
        });
        return account;
    }
    async archiveAccount(farmId, id, userId) {
        const existing = await this.getOrThrow(farmId, id);
        if (existing.deletedAt) {
            throw new common_1.ConflictException('Financial account is already archived');
        }
        const account = await this.prisma.financialAccount.update({
            where: { id },
            data: { deletedAt: new Date(), isPrimary: false },
            include: DETAIL_INCLUDE,
        });
        this.log.info('Financial account archived', {
            farmId,
            financialAccountId: id,
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Financial Account Archived',
            actionDetails: `${account.type} account "${account.name}" archived.`,
            actorId: userId ?? null,
            taggedValues: [{ key: 'sensitive', value: 'account-archived' }],
        });
        return account;
    }
    async assertAccountActive(farmId, id) {
        const account = await this.getOrThrow(farmId, id);
        if (account.deletedAt) {
            throw new common_1.BadRequestException('This financial account is archived and cannot receive new transactions');
        }
    }
    async nextCustomLedgerCode(client, farmId) {
        const counter = await client.farmCounter.upsert({
            where: { scope: `finance-v2-account:${farmId}` },
            create: {
                scope: `finance-v2-account:${farmId}`,
                value: CUSTOM_LEDGER_CODE_START,
            },
            update: { value: { increment: 1 } },
        });
        if (counter.value > CUSTOM_LEDGER_CODE_MAX) {
            throw new common_1.ConflictException(`Custom ledger account code space (${CUSTOM_LEDGER_CODE_START}-${CUSTOM_LEDGER_CODE_MAX}) is exhausted for this farm. Contact support.`);
        }
        return String(counter.value);
    }
    async getOrThrow(farmId, id) {
        const account = await this.prisma.financialAccount.findFirst({
            where: { id, farmId },
            include: DETAIL_INCLUDE,
        });
        if (!account) {
            this.log.warn('Financial account not found', {
                financialAccountId: id,
                farmId,
            });
            throw new common_1.NotFoundException('Financial account not found');
        }
        return account;
    }
};
exports.FinancialAccountService = FinancialAccountService;
exports.FinancialAccountService = FinancialAccountService = FinancialAccountService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ledger_account_service_1.LedgerAccountService,
        journal_service_1.JournalService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], FinancialAccountService);
//# sourceMappingURL=financial-account.service.js.map