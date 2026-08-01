import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CattleStatus,
  FinanceCategory,
  FinancePaymentMethod,
  FinancePaymentType,
  FinanceTxnStatus,
  FinanceTxnType,
  FixedAssetCategory,
  LoanStatus,
  Prisma,
  ReceivableKind,
  ReceivableStatus,
  WalletDirection,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { NON_VOID_TXN } from 'src/common/finance/txn-filters';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { renderCsv } from 'src/modules/reports/domain/csv-renderer';
import { ReportData } from 'src/modules/reports/domain/report-data';
import { CreateTransactionDto } from '../../presentation/dto/create-transaction.dto';
import { CreateFixedAssetDto } from '../../presentation/dto/create-fixed-asset.dto';
import {
  ExportTransactionsQueryDto,
  LedgerQueryDto,
  ReceivableQueryDto,
} from '../../presentation/dto/finance-query.dto';
import {
  AddFundsDto,
  RecordPaymentDto,
  VoidTransactionDto,
  WithdrawDto,
} from '../../presentation/dto/finance-actions.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Finance Module service (PRD §16). Farm-scoped (`farmId` from the token
 * context). Records ledger transactions (4 wizard types), auto-creates
 * receivables/payables from partial settlements, manages loans (liabilities)
 * and the wallet (cash position, parallel to the ledger — §16.7), and computes
 * the headline KPIs incl. cost-per-litre.
 */
@Injectable()
export class FinanceService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmSettings: FarmSettingsService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FinanceService.name);
  }

  // ---- Transactions / ledger ----------------------------------------------

  async recordTransaction(
    farmId: string,
    userId: string,
    dto: CreateTransactionDto,
  ) {
    const amount = round2(dto.amount);
    const isPartial = dto.paymentType === FinancePaymentType.PARTIAL;
    const paidNow = isPartial ? round2(dto.paidNow ?? 0) : amount;
    if (paidNow > amount) {
      throw new BadRequestException('paidNow cannot exceed the total amount');
    }

    const reference = await this.nextReference(farmId, 'TRX');
    const transaction = await this.prisma.financeTransaction.create({
      data: {
        farmId,
        reference,
        date: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        type: dto.type,
        category: dto.category,
        subType: dto.subType,
        entityName: dto.entityName,
        description: dto.notes,
        amount,
        paidNow,
        paymentType: dto.paymentType ?? FinancePaymentType.FULL,
        paymentMethod: dto.paymentMethod,
        status: FinanceTxnStatus.COMPLETED,
        buyerId: dto.buyerId,
        cattleId: dto.cattleId,
        inventoryItemName: dto.inventoryItemName,
        quantity: dto.quantity,
        costPerUnit: dto.costPerUnit,
        createdBy: userId,
      },
    });

    // Partial payment → receivable (income owed to us) or payable (we owe).
    let receivableCreated: string | null = null;
    let payableCreated: string | null = null;
    if (isPartial && amount - paidNow > 0) {
      const kind =
        dto.type === FinanceTxnType.REVENUE
          ? ReceivableKind.RECEIVABLE
          : ReceivableKind.PAYABLE;
      const ref = await this.nextReference(
        farmId,
        kind === ReceivableKind.RECEIVABLE ? 'REC' : 'PAY',
      );
      const created = await this.prisma.financeReceivable.create({
        data: {
          farmId,
          reference: ref,
          kind,
          entityName: dto.entityName,
          total: amount,
          paid: paidNow,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status:
            paidNow > 0 ? ReceivableStatus.PARTIAL : ReceivableStatus.PENDING,
          sourceTransactionId: transaction.id,
          createdBy: userId,
        },
      });
      if (kind === ReceivableKind.RECEIVABLE)
        receivableCreated = created.reference;
      else payableCreated = created.reference;
    }

    // Debt / loan side-effects.
    let loanCreated: string | null = null;
    if (dto.type === FinanceTxnType.DEBT_LOAN) {
      if (dto.subType === 'new_loan') {
        const loan = await this.prisma.financeLoan.create({
          data: {
            farmId,
            lenderName: dto.entityName ?? 'Lender',
            totalAmount: amount,
            monthlyEmi: dto.monthlyEmi ?? 0,
            startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
            durationMonths: dto.durationMonths ?? 0,
            createdBy: userId,
          },
        });
        loanCreated = loan.id;
      } else if (dto.subType === 'emi_payment' && dto.loanId) {
        await this.applyEmiPayment(farmId, dto.loanId, amount);
      }
    }

    // Animal sale → mark the animal Sold (PRD §16.8).
    let cattleStatusUpdated: string | null = null;
    if (
      dto.type === FinanceTxnType.REVENUE &&
      dto.subType === 'animal' &&
      dto.cattleId
    ) {
      const cattle = await this.prisma.cattle.findFirst({
        where: { id: dto.cattleId, farmId },
        select: { id: true },
      });
      if (cattle) {
        await this.prisma.cattle.update({
          where: { id: dto.cattleId },
          data: { status: CattleStatus.SOLD, isActive: false },
        });
        cattleStatusUpdated = CattleStatus.SOLD;
      }
    }

    // Wallet debit when an INVENTORY_PURCHASE is paid from the wallet — mirrors
    // `withdraw()`'s balance-check + WalletTransaction pattern. CASH/BANK_TRANSFER/
    // MFS purchases stay wallet-neutral, unchanged. Checked before the stock
    // increment below so an insufficient-balance purchase fails before touching
    // stock. Uses `paidNow`, not `amount`, so a partial-payment purchase only
    // debits what's actually paid now.
    let walletTransactionId: string | null = null;
    if (
      dto.type === FinanceTxnType.INVENTORY_PURCHASE &&
      dto.paymentMethod === FinancePaymentMethod.WALLET
    ) {
      const balance = await this.currentLiquidity(farmId);
      if (paidNow > balance) {
        throw new BadRequestException(
          'Insufficient wallet balance for this purchase',
        );
      }
      const walletReference = await this.nextReference(farmId, 'WAL');
      const walletTxn = await this.prisma.walletTransaction.create({
        data: {
          farmId,
          reference: walletReference,
          direction: WalletDirection.DEBIT,
          description: dto.inventoryItemName
            ? `Inventory purchase: ${dto.inventoryItemName}`
            : 'Inventory purchase',
          amount: paidNow,
          paymentMethod: FinancePaymentMethod.WALLET,
          date: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          createdBy: userId,
        },
      });
      walletTransactionId = walletTxn.id;
    }

    // Inventory auto-increment on INVENTORY_PURCHASE (RD-010).
    let inventoryUpdated = false;
    if (
      dto.type === FinanceTxnType.INVENTORY_PURCHASE &&
      dto.inventoryItemName &&
      dto.quantity
    ) {
      inventoryUpdated = await this.incrementInventoryStock(
        farmId,
        dto.inventoryItemName,
        dto.quantity,
      );
    }

    this.log.info('Finance transaction recorded', {
      transactionId: transaction.id,
      farmId,
      type: dto.type,
      amount,
    });

    return {
      transactionId: transaction.id,
      reference,
      amount,
      status: transaction.status,
      receivableCreated,
      payableCreated,
      loanCreated,
      cattleStatusUpdated,
      inventoryUpdated,
      walletTransactionId,
    };
  }

  async ledger(farmId: string, query: LedgerQueryDto) {
    const where = this.buildLedgerWhere(farmId, query);

    const rows = await this.prisma.financeTransaction.findMany({
      where,
      orderBy: [{ date: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    const chart = await this.ledgerChart(farmId);
    return { items: page.items, meta: { ...page.meta, chart } };
  }

  /**
   * Shared filter-building for the ledger list and the CSV export below —
   * same filters (category/status/date-range/search), just without the
   * cursor-pagination fields the export doesn't use.
   */
  private buildLedgerWhere(
    farmId: string,
    query: {
      category?: FinanceCategory;
      status?: FinanceTxnStatus;
      from?: string;
      to?: string;
      search?: string;
    },
  ): Prisma.FinanceTransactionWhereInput {
    return {
      farmId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { entityName: { contains: query.search, mode: 'insensitive' } },
              { reference: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /**
   * RD-010(c) — transactions CSV export. Reuses the ledger's own filters
   * (category/status/date-range/search) but returns every matching row (no
   * cursor pagination) rendered through the Reports engine's generic CSV
   * renderer (`renderCsv`/`ReportData`) — same shape, no new dependency.
   * Intentionally includes voided/reversal rows, same as the ledger list
   * (an audit export, not a money-sum aggregation — RD-017's `NON_VOID_TXN`
   * filter is for sums, not this).
   */
  async exportTransactionsCsv(
    farmId: string,
    query: ExportTransactionsQueryDto,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const where = this.buildLedgerWhere(farmId, query);

    const rows = await this.prisma.financeTransaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    const period =
      query.from || query.to
        ? `${query.from ?? '…'} to ${query.to ?? '…'}`
        : 'All time';

    const report: ReportData = {
      title: 'Finance Transactions Export',
      period,
      columns: [
        'Date',
        'Reference',
        'Type',
        'Category',
        'Sub Type',
        'Entity',
        'Description',
        'Amount',
        'Paid Now',
        'Payment Type',
        'Payment Method',
        'Status',
        'Voided',
      ],
      rows: rows.map((t) => [
        t.date.toISOString().slice(0, 10),
        t.reference,
        t.type,
        t.category,
        t.subType,
        t.entityName,
        t.description,
        t.amount,
        t.paidNow,
        t.paymentType,
        t.paymentMethod,
        t.status,
        t.isVoided ? 'yes' : 'no',
      ]),
    };

    const buffer = renderCsv(report);
    const fileName = `finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

    this.log.info('Finance transactions exported', {
      farmId,
      rowCount: rows.length,
    });

    return { buffer, fileName };
  }

  async voidTransaction(
    farmId: string,
    userId: string,
    id: string,
    dto: VoidTransactionDto,
  ) {
    const txn = await this.prisma.financeTransaction.findFirst({
      where: { id, farmId },
    });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.isVoided || txn.status === FinanceTxnStatus.VOIDED) {
      throw new BadRequestException('Transaction is already voided');
    }

    const reversalRef = await this.nextReference(farmId, 'TRX');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.financeTransaction.update({
        where: { id },
        data: { isVoided: true, status: FinanceTxnStatus.VOIDED },
      });
      return tx.financeTransaction.create({
        data: {
          farmId,
          reference: reversalRef,
          date: new Date(),
          type: txn.type,
          category: txn.category,
          subType: txn.subType,
          entityName: txn.entityName,
          description: `Reversal of ${txn.reference}: ${dto.reasonCategory}`,
          amount: -txn.amount,
          paidNow: -txn.paidNow,
          paymentType: txn.paymentType,
          paymentMethod: txn.paymentMethod,
          status: FinanceTxnStatus.COMPLETED,
          reversedTransactionId: txn.id,
          reversalReason: dto.reasonNotes ?? dto.reasonCategory,
          createdBy: userId,
        },
      });
    });

    this.log.info('Finance transaction voided', { originalId: id, farmId });
    return {
      originalTransactionId: txn.id,
      reversalTransactionId: result.id,
      originalStatus: FinanceTxnStatus.VOIDED,
      reversalAmount: result.amount,
    };
  }

  // ---- Receivables / payables ---------------------------------------------

  async receivables(farmId: string, query: ReceivableQueryDto) {
    return this.settlements(farmId, ReceivableKind.RECEIVABLE, query);
  }

  async payables(farmId: string, query: ReceivableQueryDto) {
    return this.settlements(farmId, ReceivableKind.PAYABLE, query);
  }

  async recordPayment(
    farmId: string,
    kind: ReceivableKind,
    id: string,
    dto: RecordPaymentDto,
  ) {
    const row = await this.prisma.financeReceivable.findFirst({
      where: { id, farmId, kind },
    });
    if (!row) throw new NotFoundException('Settlement not found');
    if (row.status === ReceivableStatus.COMPLETED) {
      throw new BadRequestException('Settlement is already fully paid');
    }

    const paid = round2(Math.min(row.total, row.paid + dto.amountPaid));
    const status =
      paid >= row.total ? ReceivableStatus.COMPLETED : ReceivableStatus.PARTIAL;
    const updated = await this.prisma.financeReceivable.update({
      where: { id },
      data: { paid, status },
    });
    this.log.info('Settlement payment recorded', { id, farmId, kind, paid });
    return { ...updated, outstanding: round2(updated.total - updated.paid) };
  }

  // ---- Liabilities ---------------------------------------------------------

  async liabilities(farmId: string) {
    const loans = await this.prisma.financeLoan.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
    });
    const active = loans.filter((l) => l.status === LoanStatus.ACTIVE);
    return {
      stats: {
        totalDebt: round2(
          active.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0),
        ),
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

  // ---- Wallet --------------------------------------------------------------

  async wallet(farmId: string) {
    const rows = await this.prisma.walletTransaction.findMany({
      where: { farmId },
      orderBy: { date: 'desc' },
      take: 50,
    });
    return {
      totalBalance: this.walletBalance(rows),
      transactions: rows.map((w) => ({
        id: w.id,
        reference: w.reference,
        type: w.direction === WalletDirection.CREDIT ? 'credit' : 'debit',
        description: w.description,
        paymentMethod: w.paymentMethod,
        amount: w.amount,
        date: w.date,
      })),
    };
  }

  async addFunds(farmId: string, userId: string, dto: AddFundsDto) {
    const reference = await this.nextReference(farmId, 'WAL');
    return this.prisma.walletTransaction.create({
      data: {
        farmId,
        reference,
        direction: WalletDirection.CREDIT,
        description: dto.description,
        amount: round2(dto.amount),
        paymentMethod: dto.paymentMethod,
        date: dto.date ? new Date(dto.date) : new Date(),
        createdBy: userId,
      },
    });
  }

  async withdraw(farmId: string, userId: string, dto: WithdrawDto) {
    const balance = await this.currentLiquidity(farmId);
    if (dto.amount > balance) {
      throw new BadRequestException('Withdrawal exceeds the wallet balance');
    }
    const reference = await this.nextReference(farmId, 'WAL');
    return this.prisma.walletTransaction.create({
      data: {
        farmId,
        reference,
        direction: WalletDirection.DEBIT,
        description: dto.fundName,
        amount: round2(dto.amount),
        paymentMethod: dto.paymentMethod,
        date: dto.date ? new Date(dto.date) : new Date(),
        createdBy: userId,
      },
    });
  }

  // ---- Highlights / assets -------------------------------------------------

  async highlights(farmId: string) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [liquidity, monthExpense, sellableLitres, runway] = await Promise.all(
      [
        this.currentLiquidity(farmId),
        this.expenseSum(farmId, monthStart, now),
        this.sellableLitres(farmId, monthStart, now),
        this.getRunwaySnapshot(farmId, now),
      ],
    );

    const costPerLitre =
      sellableLitres > 0 ? round2(monthExpense / sellableLitres) : null;

    return {
      availableLiquidity: liquidity,
      costPerLitreThisMonth: costPerLitre,
      // Herd valuation needs a per-animal market value (not modelled) — deferred.
      herdMarketValue: 0,
      survivalRunwayDays: runway.days,
      survivalRunwayStatus: runway.status,
    };
  }

  /**
   * Survival-runway snapshot (PRD §16/§20.2) — shared by `highlights()` and the
   * `survival_runway_warning` scheduler sweep, so both read one computation.
   */
  async getRunwaySnapshot(
    farmId: string,
    now: Date = new Date(),
  ): Promise<{ days: number | null; status: string }> {
    const [liquidity, avgDailyExpense, thresholds] = await Promise.all([
      this.currentLiquidity(farmId),
      this.avgDailyExpense(farmId, now),
      this.farmSettings.financeRunwayThresholds(farmId),
    ]);
    const days =
      avgDailyExpense > 0 ? Math.floor(liquidity / avgDailyExpense) : null;
    return { days, status: this.runwayStatus(days, thresholds) };
  }

  async assets(farmId: string) {
    const [
      medicines,
      feedItems,
      equipmentInv,
      fixedAssets,
      liquidity,
      loans,
      cattlePurchases,
    ] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { farmId, isActive: true },
        select: { currentStock: true, costPerUnit: true },
      }),
      this.prisma.feedItem.findMany({
        where: { farmId, isActive: true },
        select: { currentStock: true, costPerUnit: true },
      }),
      this.prisma.equipment.findMany({
        where: { farmId, isActive: true },
        select: { currentStock: true, costPerUnit: true },
      }),
      this.prisma.fixedAsset.findMany({
        where: { farmId, isActive: true },
        select: {
          name: true,
          category: true,
          purchaseDate: true,
          purchasePrice: true,
          usefulLifeYears: true,
          salvageValue: true,
        },
      }),
      this.currentLiquidity(farmId),
      this.prisma.financeLoan.findMany({
        where: { farmId, status: LoanStatus.ACTIVE },
        select: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.financeTransaction.aggregate({
        where: {
          farmId,
          type: FinanceTxnType.INVENTORY_PURCHASE,
          category: 'INVENTORY' as const,
          subType: 'animal',
          ...NON_VOID_TXN,
        },
        _sum: { amount: true },
      }),
    ]);

    const inventoryValue = round2(
      medicines.reduce((s, m) => s + m.currentStock * m.costPerUnit, 0) +
        feedItems.reduce((s, f) => s + f.currentStock * f.costPerUnit, 0) +
        equipmentInv.reduce((s, e) => s + e.currentStock * e.costPerUnit, 0),
    );

    const now = new Date();
    let equipmentBookValue = 0;
    let landStructureBookValue = 0;
    const depreciation: Array<{
      asset_name: string;
      book_value: number;
      accumulated_depreciation: number;
      useful_life_years: number;
      purchase_value: number;
    }> = [];

    for (const asset of fixedAssets) {
      const yearsElapsed =
        (now.getTime() - asset.purchaseDate.getTime()) / (365.25 * DAY_MS);
      const annualDepreciation =
        (asset.purchasePrice - asset.salvageValue) / asset.usefulLifeYears;
      const accumulated = round2(
        Math.min(
          annualDepreciation * yearsElapsed,
          asset.purchasePrice - asset.salvageValue,
        ),
      );
      const bookValue = round2(asset.purchasePrice - accumulated);
      depreciation.push({
        asset_name: asset.name,
        book_value: bookValue,
        accumulated_depreciation: accumulated,
        useful_life_years: asset.usefulLifeYears,
        purchase_value: asset.purchasePrice,
      });
      if (asset.category === FixedAssetCategory.BUILDING) {
        landStructureBookValue = round2(landStructureBookValue + bookValue);
      } else {
        equipmentBookValue = round2(equipmentBookValue + bookValue);
      }
    }

    const cattleHerdValue = round2(cattlePurchases._sum.amount ?? 0);
    const totalLiabilities = round2(
      loans.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0),
    );
    const allocation = [
      { category: 'cattle_herd', value: cattleHerdValue, color: '#1A7A4A' },
      { category: 'equipment', value: equipmentBookValue, color: '#2563EB' },
      {
        category: 'land_structure',
        value: landStructureBookValue,
        color: '#D97706',
      },
      { category: 'inventory', value: inventoryValue, color: '#7C3AED' },
      { category: 'cash_bank', value: liquidity, color: '#DC2626' },
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

  async createFixedAsset(
    farmId: string,
    userId: string,
    dto: CreateFixedAssetDto,
  ) {
    const asset = await this.prisma.fixedAsset.create({
      data: {
        farmId,
        name: dto.name,
        category: dto.category ?? FixedAssetCategory.EQUIPMENT,
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

  // ---- Helpers -------------------------------------------------------------

  /** Increment inventory stock for INVENTORY_PURCHASE transactions (RD-010). */
  private async incrementInventoryStock(
    farmId: string,
    itemName: string,
    quantity: number,
  ): Promise<boolean> {
    const nameFilter = { contains: itemName, mode: 'insensitive' as const };
    const [medicine, feedItem] = await Promise.all([
      this.prisma.medicine.findFirst({
        where: { farmId, name: nameFilter, isActive: true },
        select: { id: true },
      }),
      this.prisma.feedItem.findFirst({
        where: { farmId, name: nameFilter, isActive: true },
        select: { id: true },
      }),
    ]);
    if (medicine) {
      await this.prisma.medicine.update({
        where: { id: medicine.id },
        data: { currentStock: { increment: quantity } },
      });
      return true;
    }
    if (feedItem) {
      await this.prisma.feedItem.update({
        where: { id: feedItem.id },
        data: { currentStock: { increment: quantity } },
      });
      return true;
    }
    return false;
  }

  private async settlements(
    farmId: string,
    kind: ReceivableKind,
    query: ReceivableQueryDto,
  ) {
    const now = new Date();
    const where: Prisma.FinanceReceivableWhereInput = {
      farmId,
      kind,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { entityName: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const rows = await this.prisma.financeReceivable.findMany({
      where,
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);

    const open = await this.prisma.financeReceivable.findMany({
      where: { farmId, kind, status: { not: ReceivableStatus.COMPLETED } },
    });
    const isOverdue = (d: Date | null) =>
      d != null && d.getTime() < now.getTime();
    const stats = {
      totalOutstanding: round2(
        open.reduce((s, r) => s + (r.total - r.paid), 0),
      ),
      pendingToday: round2(
        open
          .filter((r) => r.dueDate && this.sameDay(r.dueDate, now))
          .reduce((s, r) => s + (r.total - r.paid), 0),
      ),
      overdue: round2(
        open
          .filter((r) => isOverdue(r.dueDate))
          .reduce((s, r) => s + (r.total - r.paid), 0),
      ),
    };

    return {
      items: page.items.map((r) => ({
        ...r,
        outstanding: round2(r.total - r.paid),
        status:
          r.status !== ReceivableStatus.COMPLETED && isOverdue(r.dueDate)
            ? ReceivableStatus.OVERDUE
            : r.status,
      })),
      meta: { ...page.meta, stats },
    };
  }

  private async applyEmiPayment(
    farmId: string,
    loanId: string,
    amount: number,
  ) {
    const loan = await this.prisma.financeLoan.findFirst({
      where: { id: loanId, farmId },
    });
    if (!loan) throw new BadRequestException('Loan not found for EMI payment');
    const paidAmount = round2(
      Math.min(loan.totalAmount, loan.paidAmount + amount),
    );
    await this.prisma.financeLoan.update({
      where: { id: loanId },
      data: {
        paidAmount,
        status:
          paidAmount >= loan.totalAmount
            ? LoanStatus.CLOSED
            : LoanStatus.ACTIVE,
      },
    });
  }

  private async ledgerChart(farmId: string) {
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const txns = await this.prisma.financeTransaction.findMany({
      where: {
        farmId,
        status: FinanceTxnStatus.COMPLETED,
        date: { gte: yearStart },
        ...NON_VOID_TXN,
      },
      select: { date: true, type: true, amount: true },
    });
    const months = new Map<string, { income: number; expense: number }>();
    let totalIncome = 0;
    let totalExpense = 0;
    for (const t of txns) {
      const key = t.date.toISOString().slice(0, 7);
      const row = months.get(key) ?? { income: 0, expense: 0 };
      if (t.type === FinanceTxnType.REVENUE) {
        row.income += t.amount;
        totalIncome += t.amount;
      } else {
        row.expense += t.amount;
        totalExpense += t.amount;
      }
      months.set(key, row);
    }
    const liabilities = await this.totalLiabilities(farmId);
    const assets = await this.totalAssetsValue(farmId);
    return {
      yearly: [...months.entries()]
        .map(([month, v]) => ({
          month,
          income: round2(v.income),
          expense: round2(v.expense),
          profit: round2(v.income - v.expense),
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      operatingMarginPct:
        totalIncome > 0
          ? round2(((totalIncome - totalExpense) / totalIncome) * 100)
          : 0,
      debtToAssetPct: assets > 0 ? round2((liabilities / assets) * 100) : 0,
    };
  }

  private async currentLiquidity(farmId: string): Promise<number> {
    const rows = await this.prisma.walletTransaction.findMany({
      where: { farmId },
      select: { direction: true, amount: true },
    });
    return this.walletBalance(rows);
  }

  private walletBalance(
    rows: Array<{ direction: WalletDirection; amount: number }>,
  ): number {
    return round2(
      rows.reduce(
        (s, w) =>
          s + (w.direction === WalletDirection.CREDIT ? w.amount : -w.amount),
        0,
      ),
    );
  }

  private async expenseSum(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const agg = await this.prisma.financeTransaction.aggregate({
      where: {
        farmId,
        status: FinanceTxnStatus.COMPLETED,
        type: { not: FinanceTxnType.REVENUE },
        date: { gte: from, lte: to },
        ...NON_VOID_TXN,
      },
      _sum: { amount: true },
    });
    return round2(agg._sum.amount ?? 0);
  }

  private async avgDailyExpense(farmId: string, now: Date): Promise<number> {
    const from = new Date(now.getTime() - 30 * DAY_MS);
    return round2((await this.expenseSum(farmId, from, now)) / 30);
  }

  private async sellableLitres(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const agg = await this.prisma.milkLogEntry.aggregate({
      where: {
        farmId,
        tankType: 'SELLABLE',
        submitted: true,
        logDate: { gte: from, lte: to },
      },
      _sum: { yieldL: true },
    });
    return round2(agg._sum.yieldL ?? 0);
  }

  private async totalLiabilities(farmId: string): Promise<number> {
    const loans = await this.prisma.financeLoan.findMany({
      where: { farmId, status: LoanStatus.ACTIVE },
      select: { totalAmount: true, paidAmount: true },
    });
    return round2(
      loans.reduce((s, l) => s + (l.totalAmount - l.paidAmount), 0),
    );
  }

  private async totalAssetsValue(farmId: string): Promise<number> {
    const [medicines, liquidity] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { farmId, isActive: true },
        select: { currentStock: true, costPerUnit: true },
      }),
      this.currentLiquidity(farmId),
    ]);
    const inventoryValue = medicines.reduce(
      (s, m) => s + m.currentStock * m.costPerUnit,
      0,
    );
    return round2(inventoryValue + liquidity);
  }

  private runwayStatus(
    days: number | null,
    thresholds: { warningDays: number; criticalDays: number },
  ): string {
    if (days == null) return 'unknown';
    if (days < thresholds.criticalDays) return 'critical';
    if (days < thresholds.warningDays) return 'warning';
    return 'healthy';
  }

  private sameDay(a: Date, b: Date): boolean {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  /** Per-farm sequential reference with a small retry on the unique race. */
  private async nextReference(farmId: string, prefix: string): Promise<string> {
    const counter = this.referenceCounter(prefix);
    for (let attempt = 0; attempt < 5; attempt++) {
      const n = (await counter(farmId)) + 1 + attempt;
      const reference = `${prefix}-${String(n).padStart(5, '0')}`;
      const clash = await this.referenceExists(farmId, prefix, reference);
      if (!clash) return reference;
    }
    return `${prefix}-${Date.now()}`;
  }

  private referenceCounter(
    prefix: string,
  ): (farmId: string) => Promise<number> {
    if (prefix === 'WAL') {
      return (farmId) =>
        this.prisma.walletTransaction.count({ where: { farmId } });
    }
    if (prefix === 'REC' || prefix === 'PAY') {
      const kind =
        prefix === 'REC' ? ReceivableKind.RECEIVABLE : ReceivableKind.PAYABLE;
      return (farmId) =>
        this.prisma.financeReceivable.count({ where: { farmId, kind } });
    }
    return (farmId) =>
      this.prisma.financeTransaction.count({ where: { farmId } });
  }

  private async referenceExists(
    farmId: string,
    prefix: string,
    reference: string,
  ): Promise<boolean> {
    if (prefix === 'WAL') {
      return Boolean(
        await this.prisma.walletTransaction.findFirst({
          where: { farmId, reference },
          select: { id: true },
        }),
      );
    }
    if (prefix === 'REC' || prefix === 'PAY') {
      return Boolean(
        await this.prisma.financeReceivable.findFirst({
          where: { farmId, reference },
          select: { id: true },
        }),
      );
    }
    return Boolean(
      await this.prisma.financeTransaction.findFirst({
        where: { farmId, reference },
        select: { id: true },
      }),
    );
  }
}
