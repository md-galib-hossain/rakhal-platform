import { Injectable } from '@nestjs/common';
import { FixedAssetCategory, LoanStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { CreateFixedAssetDto } from '../../presentation/dto/create-fixed-asset.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Finance Module service — **RAKHAL-354 survivor**. Originally PRD §16's
 * full ledger/wallet/settlements engine; RAKHAL-354 (`FINANCE_V2_DESIGN.md`
 * §5.3) deleted `recordTransaction`/`voidTransaction`/`ledger`/`receivables`/
 * `payables`/`recordPayment`/`wallet`/`addFunds`/`withdraw`/`highlights` —
 * every method reading the dropped `FinanceTransaction`/`FinanceReceivable`/
 * `WalletTransaction` tables — since Finance V2 (`finance-v2/**` +
 * `purchasing/**`) fully replaces them.
 *
 * **What's left, and why**: `liabilities()`/`assets()`/`createFixedAsset()`
 * — `FinanceLoan` and `FixedAsset` (`FINANCE_V2_DESIGN.md` §5.2's "survives,
 * re-pointed") never actually got a V2 loans/fixed-assets flow across the
 * whole 32-ticket milestone, so the frontend's Liabilities/Assets tabs
 * (`liabilities-view.tsx`/`asset-distribution-view.tsx`/
 * `create-asset-dialog.tsx`, deliberately kept by RAKHAL-361) still depend
 * on these 3 routes — confirmed by grepping the frontend repo before
 * touching anything: `financeApi.liabilities()`/`assets()`/`createAsset()`
 * (`features/finance/api.ts`) are the only V1 calls that survive there.
 * Deleting this whole module (the design doc's original "delete
 * `src/modules/finance/**`" instruction) would have broken those two live
 * tabs with no replacement — so this ticket keeps a slimmed module instead.
 * Filed as new tech debt (`docs/TECH_DEBT.md`) — a future ticket should give
 * loans/fixed-assets a real Finance V2 home and let this module retire
 * outright.
 *
 * `assets()`'s liquidity figure now sources from Finance V2's
 * `BalanceService` (`Rakhal Balance = Cash + Bank + MFS`) instead of the
 * dropped `WalletTransaction`. Its `cattle_herd` allocation — previously a
 * sum of V1 `FinanceTransaction` rows tagged `subType: 'animal'` — has no V2
 * replacement (RAKHAL-351 already documented this gap: no "animal
 * acquisition cost" concept exists in Purchasing) and now returns 0 rather
 * than reading a dropped table; see `report-generators.service.ts`'s
 * `herdPurchaseValue()` for the same documented gap.
 */
@Injectable()
export class FinanceService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FinanceService.name);
  }

  // ---- Liabilities -----------------------------------------------------

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

  // ---- Assets ------------------------------------------------------------

  async assets(farmId: string) {
    const [
      medicines,
      feedItems,
      equipmentInv,
      fixedAssets,
      rakhalBalance,
      loans,
    ] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { farmId, deletedAt: null },
        select: { currentStock: true, costPerUnit: true },
      }),
      // RAKHAL-448: value feed per lot (each lot's stock at its own cost), not the item total at the
      // newest lot's price.
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
        where: { farmId, status: LoanStatus.ACTIVE },
        select: { totalAmount: true, paidAmount: true },
      }),
    ]);

    const liquidity = Number(rakhalBalance.rakhalBalance);
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

    // RAKHAL-354: was a sum of V1 `FinanceTransaction` rows tagged
    // `subType: 'animal'` — no V2 replacement exists (see this class's own
    // doc comment / `report-generators.service.ts#herdPurchaseValue`).
    const cattleHerdValue = 0;
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
}
