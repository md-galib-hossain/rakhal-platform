"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEffectiveMilkRate = resolveEffectiveMilkRate;
exports.sumSaleableMilkLitres = sumSaleableMilkLitres;
exports.computeCattleFinance = computeCattleFinance;
exports.cattleExpenseBucket = cattleExpenseBucket;
const client_1 = require("@prisma/client");
async function sumUnreversedExpense(prisma, farmId, cattleId, category, start, end) {
    const rows = await prisma.expense.findMany({
        where: { farmId, cattleId, category, expenseDate: { gte: start, lt: end } },
        select: { id: true, amount: true },
    });
    if (rows.length === 0)
        return 0;
    const journalTxns = await prisma.journalTransaction.findMany({
        where: {
            farmId,
            sourceType: 'EXPENSE',
            sourceId: { in: rows.map((e) => e.id) },
            reversalOfId: null,
        },
        select: { id: true, sourceId: true },
    });
    const journalIdByExpenseId = new Map(journalTxns.map((j) => [j.sourceId, j.id]));
    const reversals = await prisma.journalTransaction.findMany({
        where: { farmId, reversalOfId: { in: journalTxns.map((j) => j.id) } },
        select: { reversalOfId: true },
    });
    const reversedJournalIds = new Set(reversals.map((r) => r.reversalOfId));
    const unreversed = rows.filter((e) => {
        const journalId = journalIdByExpenseId.get(e.id);
        return !journalId || !reversedJournalIds.has(journalId);
    });
    return unreversed.reduce((sum, e) => sum + Number(e.amount), 0);
}
async function sumFeedCost(prisma, farmId, cattleId, start, end) {
    const rows = await prisma.feedDistributionCattleItem.findMany({
        where: {
            cattleId,
            voidedAt: null,
            costTk: { not: null },
            distribution: { farmId, distributedAt: { gte: start, lt: end } },
        },
        select: { costTk: true },
    });
    return rows.reduce((sum, r) => sum + (r.costTk ?? 0), 0);
}
async function resolveEffectiveMilkRate(prisma, farmId, onOrBefore) {
    const latestMilkSaleLine = prisma.saleLine
        ? await prisma.saleLine.findFirst({
            where: {
                type: client_1.SaleLineType.MILK,
                sale: {
                    farmId,
                    status: client_1.SaleStatus.CONFIRMED,
                    saleDate: { lte: onOrBefore },
                },
            },
            orderBy: { sale: { saleDate: 'desc' } },
            select: { unitPrice: true },
        })
        : null;
    if (latestMilkSaleLine && Number(latestMilkSaleLine.unitPrice) > 0) {
        return Number(latestMilkSaleLine.unitPrice);
    }
    const latestDispatch = prisma.milkDispatch
        ? await prisma.milkDispatch.findFirst({
            where: { farmId, cancelledAt: null, dispatchedAt: { lte: onOrBefore } },
            orderBy: { dispatchedAt: 'desc' },
            select: { basePricePerLitre: true },
        })
        : null;
    if (latestDispatch && latestDispatch.basePricePerLitre > 0) {
        return latestDispatch.basePricePerLitre;
    }
    if (!prisma.milkBuyer)
        return 0;
    const activeBuyers = await prisma.milkBuyer.findMany({
        where: { farmId, deletedAt: null },
        select: { basePricePerLitre: true },
    });
    if (activeBuyers.length === 0)
        return 0;
    const validBuyers = activeBuyers.filter((b) => b.basePricePerLitre !== null && b.basePricePerLitre > 0);
    if (validBuyers.length === 0)
        return 0;
    const sum = validBuyers.reduce((acc, b) => acc + (b.basePricePerLitre ?? 0), 0);
    return sum / validBuyers.length;
}
async function sumSaleableMilkLitres(prisma, cattleId, start, end) {
    if (!prisma.milkLogEntry)
        return 0;
    const rows = await prisma.milkLogEntry.findMany({
        where: {
            cattleId,
            disposition: client_1.MilkDisposition.SALEABLE,
            logDate: { gte: start, lt: end },
        },
        select: { yieldL: true },
    });
    return rows.reduce((sum, r) => sum + r.yieldL, 0);
}
async function computeCattleFinance(prisma, farmId, cattleId, start, end) {
    const [animalSaleLines, breedingCost, healthCost, feedCost, saleableLitres,] = await Promise.all([
        prisma.animalSaleLine.findMany({
            where: {
                cattleId,
                saleLine: {
                    sale: {
                        farmId,
                        status: client_1.SaleStatus.CONFIRMED,
                        saleDate: { gte: start, lt: end },
                    },
                },
            },
            select: { saleLine: { select: { totalAmount: true } } },
        }),
        sumUnreversedExpense(prisma, farmId, cattleId, client_1.ExpenseCategory.BREEDING, start, end),
        sumUnreversedExpense(prisma, farmId, cattleId, client_1.ExpenseCategory.HEALTH, start, end),
        sumFeedCost(prisma, farmId, cattleId, start, end),
        sumSaleableMilkLitres(prisma, cattleId, start, end),
    ]);
    const effectiveRate = saleableLitres > 0
        ? await resolveEffectiveMilkRate(prisma, farmId, end)
        : 0;
    const milkRevenue = Math.round(saleableLitres * effectiveRate * 100) / 100;
    let totalIncome = milkRevenue;
    const income = { milk_sales: milkRevenue, calf_sales: 0 };
    for (const line of animalSaleLines) {
        const amount = Number(line.saleLine.totalAmount);
        totalIncome += amount;
        income.calf_sales += amount;
    }
    const expense = {
        feed: feedCost,
        health: healthCost,
        breeding: breedingCost,
        others: 0,
    };
    const totalCost = feedCost + breedingCost + healthCost;
    return { totalIncome, totalCost, expense, income };
}
function cattleExpenseBucket(category) {
    if (category === client_1.ExpenseCategory.BREEDING)
        return 'breeding';
    if (category === client_1.ExpenseCategory.HEALTH)
        return 'health';
    return 'others';
}
//# sourceMappingURL=cattle-finance-aggregation.js.map