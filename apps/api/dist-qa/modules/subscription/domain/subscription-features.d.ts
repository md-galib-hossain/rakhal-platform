export declare const FEATURES: {
    readonly CATTLE: "cattle.module";
    readonly MILK: "milk.module";
    readonly TASKS: "tasks.module";
    readonly DASHBOARD_BASIC: "dashboard.basic";
    readonly REPRODUCTION: "reproduction.module";
    readonly HEALTHCARE: "healthcare.module";
    readonly INVENTORY: "inventory.module";
    readonly FINANCE: "finance.module";
    readonly FEED_FORMULATOR: "feed.formulator";
    readonly BUYERS_DISPATCH: "buyers.dispatch";
    readonly SMS_NOTIFICATIONS: "sms.notifications";
    readonly REPORTS_GENERATE: "reports.generate";
    readonly SCOREBOARD: "scoreboard.read";
    readonly DASHBOARD_ADVANCED: "dashboard.advanced";
    readonly REPORTS_SCHEDULED: "reports.scheduled";
};
export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];
export interface FeatureDef {
    key: FeatureKey;
    description: string;
}
export declare const FEATURE_CATALOGUE: FeatureDef[];
export interface PlanDef {
    name: string;
    description: string;
    monthlyPrice: number;
    yearlyPrice: number | null;
    maxCattle: number | null;
    maxFarmMembers: number | null;
    features: FeatureKey[];
}
export declare const PLAN_CATALOGUE: PlanDef[];
export declare const PLAN_NAMES: {
    readonly FREE: "Free";
    readonly STARTER: "Starter";
    readonly PRO: "Pro";
};
export declare const TRIAL_PLAN_NAME: string;
export declare const TRIAL_DURATION_DAYS = 14;
export declare const GRACE_PERIOD_DAYS = 3;
