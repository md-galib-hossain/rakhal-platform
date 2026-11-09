"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRACE_PERIOD_DAYS = exports.TRIAL_DURATION_DAYS = exports.TRIAL_PLAN_NAME = exports.PLAN_NAMES = exports.PLAN_CATALOGUE = exports.FEATURE_CATALOGUE = exports.FEATURES = void 0;
exports.FEATURES = {
    CATTLE: 'cattle.module',
    MILK: 'milk.module',
    TASKS: 'tasks.module',
    DASHBOARD_BASIC: 'dashboard.basic',
    REPRODUCTION: 'reproduction.module',
    HEALTHCARE: 'healthcare.module',
    INVENTORY: 'inventory.module',
    FINANCE: 'finance.module',
    FEED_FORMULATOR: 'feed.formulator',
    BUYERS_DISPATCH: 'buyers.dispatch',
    SMS_NOTIFICATIONS: 'sms.notifications',
    REPORTS_GENERATE: 'reports.generate',
    SCOREBOARD: 'scoreboard.read',
    DASHBOARD_ADVANCED: 'dashboard.advanced',
    REPORTS_SCHEDULED: 'reports.scheduled',
};
exports.FEATURE_CATALOGUE = [
    { key: exports.FEATURES.CATTLE, description: 'Cattle management' },
    { key: exports.FEATURES.MILK, description: 'Milk logging' },
    { key: exports.FEATURES.TASKS, description: 'Task hub' },
    { key: exports.FEATURES.DASHBOARD_BASIC, description: 'Basic dashboard' },
    { key: exports.FEATURES.REPRODUCTION, description: 'Reproduction module' },
    { key: exports.FEATURES.HEALTHCARE, description: 'Healthcare module' },
    { key: exports.FEATURES.INVENTORY, description: 'Inventory module' },
    { key: exports.FEATURES.FINANCE, description: 'Finance module' },
    { key: exports.FEATURES.FEED_FORMULATOR, description: 'Feed formulator' },
    { key: exports.FEATURES.BUYERS_DISPATCH, description: 'Milk buyers & dispatch' },
    { key: exports.FEATURES.SMS_NOTIFICATIONS, description: 'SMS notifications' },
    { key: exports.FEATURES.REPORTS_GENERATE, description: 'Reports engine' },
    { key: exports.FEATURES.SCOREBOARD, description: 'Scoreboard / leaderboard' },
    { key: exports.FEATURES.DASHBOARD_ADVANCED, description: 'Advanced analytics' },
    { key: exports.FEATURES.REPORTS_SCHEDULED, description: 'Scheduled reports' },
];
const FREE_FEATURES = [
    exports.FEATURES.CATTLE,
    exports.FEATURES.MILK,
    exports.FEATURES.TASKS,
    exports.FEATURES.DASHBOARD_BASIC,
];
const STARTER_FEATURES = [
    ...FREE_FEATURES,
    exports.FEATURES.REPRODUCTION,
    exports.FEATURES.HEALTHCARE,
    exports.FEATURES.INVENTORY,
    exports.FEATURES.FINANCE,
    exports.FEATURES.FEED_FORMULATOR,
    exports.FEATURES.BUYERS_DISPATCH,
    exports.FEATURES.SMS_NOTIFICATIONS,
];
const PRO_FEATURES = [
    ...STARTER_FEATURES,
    exports.FEATURES.REPORTS_GENERATE,
    exports.FEATURES.SCOREBOARD,
    exports.FEATURES.DASHBOARD_ADVANCED,
    exports.FEATURES.REPORTS_SCHEDULED,
];
exports.PLAN_CATALOGUE = [
    {
        name: 'Free',
        description: 'Trial / evaluation — core herd + milk + tasks for up to 20 cattle.',
        monthlyPrice: 0,
        yearlyPrice: 0,
        maxCattle: 20,
        maxFarmMembers: 2,
        features: FREE_FEATURES,
    },
    {
        name: 'Starter',
        description: 'Working farms (20–100 animals): all core modules + finance, feed, SMS.',
        monthlyPrice: 1000,
        yearlyPrice: 10000,
        maxCattle: 100,
        maxFarmMembers: 5,
        features: STARTER_FEATURES,
    },
    {
        name: 'Pro',
        description: 'Larger farms (100–500 animals): everything + reports, scoreboard, advanced analytics.',
        monthlyPrice: 2500,
        yearlyPrice: 25000,
        maxCattle: null,
        maxFarmMembers: null,
        features: PRO_FEATURES,
    },
];
exports.PLAN_NAMES = {
    FREE: 'Free',
    STARTER: 'Starter',
    PRO: 'Pro',
};
exports.TRIAL_PLAN_NAME = exports.PLAN_NAMES.STARTER;
exports.TRIAL_DURATION_DAYS = 14;
exports.GRACE_PERIOD_DAYS = 3;
//# sourceMappingURL=subscription-features.js.map