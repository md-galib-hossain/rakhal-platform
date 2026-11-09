declare class CattleModuleDto {
    id_format?: string;
    tag_prefix?: string;
    avg_daily_milk_target_range?: string;
}
declare class MilkModuleDto {
    morning_start?: string;
    morning_end?: string;
    noon_start?: string;
    noon_end?: string;
    evening_start?: string;
    evening_end?: string;
    night_start?: string;
    night_end?: string;
    milk_unit?: string;
    anomaly_threshold_pct?: number;
    colostrum_window_days?: number;
}
declare class ReproductionModuleDto {
    vwp_days?: number;
    pregnancy_check_days?: number;
    target_calving_interval_days?: number;
    dry_period_target_days?: number;
}
declare class FinanceModuleDto {
    currency?: string;
    currency_symbol?: string;
    survival_runway_warning_days?: number;
    survival_runway_critical_days?: number;
    financial_year_start_month?: number;
}
declare class HealthModuleDto {
    herd_health_score_warning_pct?: number;
    scc_alert_threshold?: number;
    morbidity_outbreak_threshold_pct?: number;
}
export declare class UpdateModuleSettingsDto {
    cattle?: CattleModuleDto;
    milk?: MilkModuleDto;
    reproduction?: ReproductionModuleDto;
    finance?: FinanceModuleDto;
    health?: HealthModuleDto;
}
export {};
