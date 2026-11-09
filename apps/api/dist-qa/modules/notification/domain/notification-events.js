"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_EVENTS = void 0;
exports.getEvent = getEvent;
exports.isKnownEvent = isKnownEvent;
exports.externalChannels = externalChannels;
const ch = (opts = {}) => ({
    in_app: true,
    push: opts.push ?? true,
    sms: opts.sms ?? false,
    whatsapp: opts.whatsapp ?? false,
    telegram: opts.telegram ?? false,
    email: opts.email ?? false,
});
const evt = (key, label, category, priority, canDisable, defaultChannels) => ({
    key,
    label,
    category,
    priority,
    canDisable,
    defaultChannels,
});
exports.NOTIFICATION_EVENTS = [
    evt('animal_sickness_reported', 'Animal Sickness Reported', 'health_safety', 'critical', false, ch({ sms: true })),
    evt('medicine_expired', 'Medicine Expired', 'health_safety', 'high', false, ch({ sms: true })),
    evt('withholding_active', 'Withholding Period Active', 'health_safety', 'high', false, ch()),
    evt('withholding_ended', 'Withholding Period Ended', 'health_safety', 'medium', false, ch()),
    evt('morbidity_outbreak', 'Morbidity Outbreak Alert', 'health_safety', 'critical', false, ch({ sms: true })),
    evt('vwp_complete_ready_ai', 'VWP Complete — Ready for AI', 'reproduction', 'medium', true, ch()),
    evt('low_medicine_stock', 'Low Medicine Stock', 'operational', 'medium', true, ch()),
    evt('low_feed_stock', 'Low Feed Stock', 'operational', 'medium', true, ch()),
    evt('daily_milk_log_reminder', 'Daily Milk Log Reminder', 'operational', 'medium', true, ch({ sms: true })),
    evt('task_overdue', 'Task Overdue', 'operational', 'medium', true, ch()),
    evt('safety_critical_task_overdue', 'Safety Critical Task Overdue', 'operational', 'high', false, ch({ sms: true })),
    evt('todays_tasks_ready', "Today's Tasks Ready", 'operational', 'low', true, ch()),
    evt('bulk_event_recorded', 'Bulk Event Recorded', 'operational', 'low', true, ch()),
    evt('follow_up_upcoming', 'Follow-up Coming Up', 'operational', 'medium', true, ch()),
    evt('follow_up_due_today', 'Follow-up Due Today', 'operational', 'high', true, ch({ sms: true })),
    evt('follow_up_overdue', 'Follow-up Overdue', 'operational', 'high', true, ch({ sms: true })),
    evt('health_task_reminder', 'Health Step Coming Up', 'operational', 'medium', true, ch()),
    evt('health_task_due_tomorrow', 'Health Step Due Tomorrow', 'operational', 'high', true, ch({ sms: true })),
    evt('health_task_due_today', 'Health Step Due Today', 'operational', 'high', true, ch({ sms: true })),
    evt('health_task_overdue', 'Health Step Overdue', 'operational', 'high', true, ch({ sms: true })),
    evt('payment_overdue', 'Payment Overdue', 'financial', 'high', true, ch({ sms: true })),
    evt('survival_runway_warning', 'Survival Runway Warning', 'financial', 'high', true, ch({ sms: true })),
    evt('supplier_payment_due_soon', 'Supplier Payment Due Soon', 'financial', 'medium', true, ch()),
    evt('subscription_renewal_reminder', 'Subscription Renewal Reminder', 'financial', 'high', true, ch()),
    evt('subscription_winback', 'Subscription Win-back', 'financial', 'low', true, ch()),
    evt('medicine_expiring_30_days', 'Medicine Expiring in 30 Days', 'inventory', 'medium', true, ch()),
    evt('semen_tank_low_ln2', 'Semen Tank Low LN2', 'inventory', 'high', true, ch({ sms: true })),
    evt('scheduled_upcoming', 'Coming Up', 'operational', 'medium', true, ch()),
    evt('scheduled_due', 'Due Today', 'operational', 'high', true, ch({ sms: true })),
    evt('scheduled_overdue', 'Overdue', 'operational', 'high', true, ch({ sms: true })),
    evt('custom_reminder', 'Reminder', 'operational', 'medium', true, ch()),
    evt('admin_broadcast', 'Admin Announcement', 'operational', 'high', false, ch({
        telegram: true,
        push: true,
        sms: false,
        whatsapp: false,
        email: false,
    })),
];
const BY_KEY = new Map(exports.NOTIFICATION_EVENTS.map((e) => [e.key, e]));
function getEvent(key) {
    return BY_KEY.get(key);
}
function isKnownEvent(key) {
    return BY_KEY.has(key);
}
function externalChannels(channels) {
    const order = [
        'push',
        'sms',
        'whatsapp',
        'telegram',
        'email',
    ];
    return order.filter((c) => channels[c]);
}
//# sourceMappingURL=notification-events.js.map