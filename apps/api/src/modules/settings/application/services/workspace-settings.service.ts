import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FarmModuleSettings, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateSupplierDto } from '../../presentation/dto/create-supplier.dto';
import { UpdateSupplierDto } from '../../presentation/dto/update-supplier.dto';
import { UpdateModuleSettingsDto } from '../../presentation/dto/update-module-settings.dto';

/**
 * Settings → Module config, Suppliers, Billing (PRD §21.5–21.7 / API §18 —
 * RAKHAL-032). Module settings persist the cross-module tunables (a row is lazily
 * created with defaults on first access); modules consume hard-coded constants today
 * (wiring is TECH_DEBT RD-014). Billing is read-only off the subscription. `farmId`
 * from the token context.
 */
@Injectable()
export class WorkspaceSettingsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(WorkspaceSettingsService.name);
  }

  // ── Module settings ─────────────────────────────────────────────────────────

  async getModules(farmId: string) {
    const settings = await this.ensureModuleSettings(farmId);
    return this.mapModules(settings);
  }

  async updateModules(farmId: string, dto: UpdateModuleSettingsDto) {
    await this.ensureModuleSettings(farmId);
    const data: Prisma.FarmModuleSettingsUpdateInput = {};

    if (dto.cattle) {
      this.assign(data, 'cattleIdFormat', dto.cattle.id_format);
      this.assign(data, 'cattleTagPrefix', dto.cattle.tag_prefix);
      this.assign(
        data,
        'cattleAvgMilkTargetRange',
        dto.cattle.avg_daily_milk_target_range,
      );
    }
    if (dto.milk) {
      this.assign(data, 'milkActiveSessions', dto.milk.active_sessions);
      this.assign(data, 'milkMorningStart', dto.milk.morning_start);
      this.assign(data, 'milkMorningEnd', dto.milk.morning_end);
      this.assign(data, 'milkNoonStart', dto.milk.noon_start);
      this.assign(data, 'milkNoonEnd', dto.milk.noon_end);
      this.assign(data, 'milkEveningStart', dto.milk.evening_start);
      this.assign(data, 'milkEveningEnd', dto.milk.evening_end);
      this.assign(data, 'milkNightStart', dto.milk.night_start);
      this.assign(data, 'milkNightEnd', dto.milk.night_end);
      this.assign(data, 'milkUnit', dto.milk.milk_unit);
      this.assign(
        data,
        'milkAnomalyThresholdPct',
        dto.milk.anomaly_threshold_pct,
      );
    }
    if (dto.reproduction) {
      this.assign(data, 'reproVwpDays', dto.reproduction.vwp_days);
      this.assign(
        data,
        'reproTargetCalvingIntervalDays',
        dto.reproduction.target_calving_interval_days,
      );
      this.assign(
        data,
        'reproDryPeriodTargetDays',
        dto.reproduction.dry_period_target_days,
      );
    }
    if (dto.finance) {
      this.assign(data, 'financeCurrency', dto.finance.currency);
      this.assign(data, 'financeCurrencySymbol', dto.finance.currency_symbol);
      this.assign(
        data,
        'financeRunwayWarningDays',
        dto.finance.survival_runway_warning_days,
      );
      this.assign(
        data,
        'financeRunwayCriticalDays',
        dto.finance.survival_runway_critical_days,
      );
      this.assign(
        data,
        'financeYearStartMonth',
        dto.finance.financial_year_start_month,
      );
    }
    if (dto.health) {
      this.assign(
        data,
        'healthScoreWarningPct',
        dto.health.herd_health_score_warning_pct,
      );
      this.assign(
        data,
        'healthSccAlertThreshold',
        dto.health.scc_alert_threshold,
      );
      this.assign(
        data,
        'healthMorbidityOutbreakPct',
        dto.health.morbidity_outbreak_threshold_pct,
      );
    }

    const updated = await this.prisma.farmModuleSettings.update({
      where: { farmId },
      data,
    });
    this.log.info('Module settings updated', { farmId });
    return this.mapModules(updated);
  }

  // ── Suppliers ───────────────────────────────────────────────────────────────

  async listSuppliers(farmId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { farmId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return { suppliers: suppliers.map((s) => this.mapSupplier(s)) };
  }

  async createSupplier(farmId: string, dto: CreateSupplierDto) {
    try {
      const supplier = await this.prisma.supplier.create({
        data: {
          farmId,
          name: dto.name,
          contact: dto.contact,
          phone: dto.phone,
          category: dto.category,
          paymentTerms: dto.payment_terms,
          notes: dto.notes,
        },
      });
      this.log.info('Supplier created', { supplierId: supplier.id, farmId });
      return this.mapSupplier(supplier);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('A supplier with that name already exists');
      }
      throw e;
    }
  }

  async updateSupplier(farmId: string, id: string, dto: UpdateSupplierDto) {
    await this.getSupplierOrThrow(farmId, id);
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contact !== undefined ? { contact: dto.contact } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.payment_terms !== undefined
          ? { paymentTerms: dto.payment_terms }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
      },
    });
    return this.mapSupplier(supplier);
  }

  async deleteSupplier(farmId: string, id: string) {
    await this.getSupplierOrThrow(farmId, id);
    await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Supplier deactivated', { supplierId: id, farmId });
    return { id, is_active: false };
  }

  // ── Billing ───────────────────────────────────────────────────────────────--

  async getBilling(farmId: string) {
    const subscription = await this.prisma.farmSubscription.findFirst({
      where: { farmId },
      include: { subscriptionPlan: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      current_plan: subscription
        ? {
            name: subscription.subscriptionPlan.name,
            price_per_month: Number(subscription.subscriptionPlan.monthlyPrice),
            currency: 'Tk',
            status: subscription.status.toLowerCase(),
            next_billing_date: subscription.expiresAt,
          }
        : null,
      // No payment provider/invoice store yet — surfaced empty (deferred).
      payment_method: null,
      invoices: [],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────--

  private async ensureModuleSettings(
    farmId: string,
  ): Promise<FarmModuleSettings> {
    const existing = await this.prisma.farmModuleSettings.findUnique({
      where: { farmId },
    });
    if (existing) return existing;
    return this.prisma.farmModuleSettings.create({ data: { farmId } });
  }

  private async getSupplierOrThrow(farmId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, farmId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  private assign<K extends keyof Prisma.FarmModuleSettingsUpdateInput>(
    data: Prisma.FarmModuleSettingsUpdateInput,
    key: K,
    value: Prisma.FarmModuleSettingsUpdateInput[K] | undefined,
  ): void {
    if (value !== undefined) data[key] = value;
  }

  private mapSupplier(s: {
    id: string;
    name: string;
    contact: string | null;
    phone: string | null;
    category: string | null;
    paymentTerms: string | null;
    notes: string | null;
    isActive: boolean;
  }) {
    return {
      id: s.id,
      name: s.name,
      contact: s.contact,
      phone: s.phone,
      category: s.category,
      payment_terms: s.paymentTerms,
      notes: s.notes,
      is_active: s.isActive,
    };
  }

  private mapModules(s: FarmModuleSettings) {
    return {
      cattle: {
        id_format: s.cattleIdFormat,
        tag_prefix: s.cattleTagPrefix,
        avg_daily_milk_target_range: s.cattleAvgMilkTargetRange,
      },
      milk: {
        active_sessions: s.milkActiveSessions,
        morning_start: s.milkMorningStart,
        morning_end: s.milkMorningEnd,
        noon_start: s.milkNoonStart,
        noon_end: s.milkNoonEnd,
        evening_start: s.milkEveningStart,
        evening_end: s.milkEveningEnd,
        night_start: s.milkNightStart,
        night_end: s.milkNightEnd,
        milk_unit: s.milkUnit,
        anomaly_threshold_pct: s.milkAnomalyThresholdPct,
      },
      reproduction: {
        vwp_days: s.reproVwpDays,
        target_calving_interval_days: s.reproTargetCalvingIntervalDays,
        dry_period_target_days: s.reproDryPeriodTargetDays,
      },
      finance: {
        currency: s.financeCurrency,
        currency_symbol: s.financeCurrencySymbol,
        survival_runway_warning_days: s.financeRunwayWarningDays,
        survival_runway_critical_days: s.financeRunwayCriticalDays,
        financial_year_start_month: s.financeYearStartMonth,
      },
      health: {
        herd_health_score_warning_pct: s.healthScoreWarningPct,
        scc_alert_threshold: s.healthSccAlertThreshold,
        morbidity_outbreak_threshold_pct: s.healthMorbidityOutbreakPct,
      },
    };
  }
}
