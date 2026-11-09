import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateSupplierDto } from '../../presentation/dto/create-supplier.dto';
import { UpdateSupplierDto } from '../../presentation/dto/update-supplier.dto';
import { CreateServiceProviderDto } from '../../presentation/dto/create-service-provider.dto';
import { UpdateServiceProviderDto } from '../../presentation/dto/update-service-provider.dto';
import { UpdateModuleSettingsDto } from '../../presentation/dto/update-module-settings.dto';
import { UpdateMilkSessionsDto } from '../../presentation/dto/update-milk-sessions.dto';
export declare class WorkspaceSettingsService {
    private readonly prisma;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService, activityLog: ActivityLogService);
    private recordSupplierActivity;
    getModules(farmId: string): Promise<{
        cattle: {
            id_format: string;
            tag_prefix: string | null;
            avg_daily_milk_target_range: string | null;
        };
        milk: {
            active_sessions: string[];
            morning_start: string;
            morning_end: string;
            noon_start: string;
            noon_end: string;
            evening_start: string;
            evening_end: string;
            night_start: string;
            night_end: string;
            milk_unit: string;
            anomaly_threshold_pct: number;
            colostrum_window_days: number;
        };
        reproduction: {
            vwp_days: number;
            pregnancy_check_days: number;
            target_calving_interval_days: number;
            dry_period_target_days: number;
        };
        finance: {
            currency: string;
            currency_symbol: string;
            survival_runway_warning_days: number;
            survival_runway_critical_days: number;
            financial_year_start_month: number;
        };
        health: {
            herd_health_score_warning_pct: number;
            scc_alert_threshold: number;
            morbidity_outbreak_threshold_pct: number;
        };
    }>;
    updateModules(farmId: string, dto: UpdateModuleSettingsDto): Promise<{
        cattle: {
            id_format: string;
            tag_prefix: string | null;
            avg_daily_milk_target_range: string | null;
        };
        milk: {
            active_sessions: string[];
            morning_start: string;
            morning_end: string;
            noon_start: string;
            noon_end: string;
            evening_start: string;
            evening_end: string;
            night_start: string;
            night_end: string;
            milk_unit: string;
            anomaly_threshold_pct: number;
            colostrum_window_days: number;
        };
        reproduction: {
            vwp_days: number;
            pregnancy_check_days: number;
            target_calving_interval_days: number;
            dry_period_target_days: number;
        };
        finance: {
            currency: string;
            currency_symbol: string;
            survival_runway_warning_days: number;
            survival_runway_critical_days: number;
            financial_year_start_month: number;
        };
        health: {
            herd_health_score_warning_pct: number;
            scc_alert_threshold: number;
            morbidity_outbreak_threshold_pct: number;
        };
    }>;
    updateMilkSessions(farmId: string, dto: UpdateMilkSessionsDto): Promise<{
        active_sessions: string[];
        morning_start: string;
        morning_end: string;
        noon_start: string;
        noon_end: string;
        evening_start: string;
        evening_end: string;
        night_start: string;
        night_end: string;
        milk_unit: string;
        anomaly_threshold_pct: number;
        colostrum_window_days: number;
    }>;
    listSuppliers(farmId: string): Promise<{
        suppliers: {
            id: string;
            name: string;
            contact: string | null;
            phone: string | null;
            category: string | null;
            payment_terms: string | null;
            payment_terms_days: number;
            notes: string | null;
            deleted_at: Date | null;
        }[];
    }>;
    createSupplier(farmId: string, dto: CreateSupplierDto, userId?: string): Promise<{
        id: string;
        name: string;
        contact: string | null;
        phone: string | null;
        category: string | null;
        payment_terms: string | null;
        payment_terms_days: number;
        notes: string | null;
        deleted_at: Date | null;
    }>;
    updateSupplier(farmId: string, id: string, dto: UpdateSupplierDto, userId?: string): Promise<{
        id: string;
        name: string;
        contact: string | null;
        phone: string | null;
        category: string | null;
        payment_terms: string | null;
        payment_terms_days: number;
        notes: string | null;
        deleted_at: Date | null;
    }>;
    deleteSupplier(farmId: string, id: string, userId?: string): Promise<{
        id: string;
        deleted_at: Date;
    }>;
    listServiceProviders(farmId: string): Promise<{
        service_providers: {
            id: string;
            name: string;
            phone: string | null;
            type: string;
            deleted_at: Date | null;
        }[];
    }>;
    createServiceProvider(farmId: string, dto: CreateServiceProviderDto): Promise<{
        id: string;
        name: string;
        phone: string | null;
        type: string;
        deleted_at: Date | null;
    }>;
    updateServiceProvider(farmId: string, id: string, dto: UpdateServiceProviderDto): Promise<{
        id: string;
        name: string;
        phone: string | null;
        type: string;
        deleted_at: Date | null;
    }>;
    deleteServiceProvider(farmId: string, id: string): Promise<{
        id: string;
        deleted_at: Date;
    }>;
    getBilling(farmId: string): Promise<{
        current_plan: {
            name: string;
            price_per_month: number;
            currency: string;
            status: string;
            next_billing_date: Date | null;
        } | null;
        payment_method: null;
        invoices: never[];
    }>;
    private ensureModuleSettings;
    private getSupplierOrThrow;
    private getServiceProviderOrThrow;
    private assign;
    private mapSupplier;
    private mapServiceProvider;
    private mapModules;
}
