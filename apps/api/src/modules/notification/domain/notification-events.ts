/**
 * Notification event catalogue (PRD §20.2) — the single source of truth for
 * which events exist, their category/priority, whether a user may disable them,
 * and the default delivery channels. Pure data; no framework/Prisma imports.
 *
 * Health & Safety events are **always sent and cannot be disabled** (PRD §20.2).
 * `in_app` and `push` are on by default (the free, always-available channels);
 * `sms`/`whatsapp`/`telegram`/`email` are opt-in per event and require a
 * configured provider (see `application/channels/*`). The in-app channel is the
 * `Notification` row itself; everything else goes through a `ChannelProvider`.
 */

export type NotificationCategory =
  | 'health_safety'
  | 'reproduction'
  | 'operational'
  | 'financial'
  | 'inventory';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

/** A delivery channel. Add a new one here + implement a `ChannelProvider`. */
export type NotificationChannel =
  | 'in_app'
  | 'push'
  | 'sms'
  | 'whatsapp'
  | 'telegram'
  | 'email';

export interface NotificationChannels {
  in_app: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  telegram: boolean;
  email: boolean;
}

export interface NotificationEventDef {
  key: string;
  label: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  /** Health & Safety events are mandatory — the user cannot turn them off. */
  canDisable: boolean;
  defaultChannels: NotificationChannels;
}

/** `in_app` + `push` are always on by default; pass the extra channels you want. */
const ch = (
  opts: Partial<Omit<NotificationChannels, 'in_app' | 'push'>> & {
    push?: boolean;
  } = {},
): NotificationChannels => ({
  in_app: true,
  push: opts.push ?? true,
  sms: opts.sms ?? false,
  whatsapp: opts.whatsapp ?? false,
  telegram: opts.telegram ?? false,
  email: opts.email ?? false,
});

const evt = (
  key: string,
  label: string,
  category: NotificationCategory,
  priority: NotificationPriority,
  canDisable: boolean,
  defaultChannels: NotificationChannels,
): NotificationEventDef => ({
  key,
  label,
  category,
  priority,
  canDisable,
  defaultChannels,
});

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  // ── Health & Safety (cannot be disabled) ──────────────────────────────────
  evt(
    'animal_sickness_reported',
    'Animal Sickness Reported',
    'health_safety',
    'critical',
    false,
    ch({ sms: true }),
  ),
  evt(
    'medicine_expired',
    'Medicine Expired',
    'health_safety',
    'high',
    false,
    ch({ sms: true }),
  ),
  evt(
    'withholding_active',
    'Withholding Period Active',
    'health_safety',
    'high',
    false,
    ch(),
  ),
  evt(
    'withholding_ended',
    'Withholding Period Ended',
    'health_safety',
    'medium',
    false,
    ch(),
  ),
  evt(
    'morbidity_outbreak',
    'Morbidity Outbreak Alert',
    'health_safety',
    'critical',
    false,
    ch({ sms: true }),
  ),
  // ── Reproduction ──────────────────────────────────────────────────────────
  evt(
    'calving_expected_3_days',
    'Calving Expected in 3 Days',
    'reproduction',
    'high',
    true,
    ch({ sms: true }),
  ),
  evt(
    'cow_expected_in_heat',
    'Cow Expected in Heat',
    'reproduction',
    'medium',
    true,
    ch(),
  ),
  evt(
    'pregnancy_check_due',
    'Pregnancy Check Due',
    'reproduction',
    'medium',
    true,
    ch(),
  ),
  evt(
    'vwp_complete_ready_ai',
    'VWP Complete — Ready for AI',
    'reproduction',
    'medium',
    true,
    ch(),
  ),
  evt(
    'dry_off_due_14_days',
    'Dry-Off Due in 14 Days',
    'reproduction',
    'medium',
    true,
    ch(),
  ),
  // ── Operational ───────────────────────────────────────────────────────────
  evt(
    'low_medicine_stock',
    'Low Medicine Stock',
    'operational',
    'medium',
    true,
    ch(),
  ),
  evt('low_feed_stock', 'Low Feed Stock', 'operational', 'medium', true, ch()),
  evt(
    'daily_milk_log_reminder',
    'Daily Milk Log Reminder',
    'operational',
    'medium',
    true,
    ch({ sms: true }),
  ),
  evt('task_overdue', 'Task Overdue', 'operational', 'medium', true, ch()),
  evt(
    'safety_critical_task_overdue',
    'Safety Critical Task Overdue',
    'operational',
    'high',
    false,
    ch({ sms: true }),
  ),
  evt(
    'todays_tasks_ready',
    "Today's Tasks Ready",
    'operational',
    'low',
    true,
    ch(),
  ),
  // RAKHAL-465 — scheduled health steps (protocol doses/vaccinations). Split by urgency band so only the close-in
  // reminders and the overdue nag are SMS-eligible once a provider is live; T-7/T-3 stay in-app + push.
  evt(
    'health_task_reminder',
    'Health Step Coming Up',
    'operational',
    'medium',
    true,
    ch(),
  ),
  evt(
    'health_task_due_tomorrow',
    'Health Step Due Tomorrow',
    'operational',
    'high',
    true,
    ch({ sms: true }),
  ),
  evt(
    'health_task_due_today',
    'Health Step Due Today',
    'operational',
    'high',
    true,
    ch({ sms: true }),
  ),
  evt(
    'health_task_overdue',
    'Health Step Overdue',
    'operational',
    'high',
    true,
    ch({ sms: true }),
  ),
  // ── Financial ─────────────────────────────────────────────────────────────
  evt(
    'payment_overdue',
    'Payment Overdue',
    'financial',
    'high',
    true,
    ch({ sms: true }),
  ),
  evt(
    'survival_runway_warning',
    'Survival Runway Warning',
    'financial',
    'high',
    true,
    ch({ sms: true }),
  ),
  evt(
    'supplier_payment_due_soon',
    'Supplier Payment Due Soon',
    'financial',
    'medium',
    true,
    ch(),
  ),
  // Subscription renewal campaign (RAKHAL-240). Disablable — the in-app path
  // respects the opt-out automatically; the pre-expiry reminder email is
  // billing-transactional (always sent), the post-expiry win-back email honours
  // the opt-out. Email is dispatched via the idempotent transactional pipeline,
  // so the default channel set is in-app (+push) only here.
  evt(
    'subscription_renewal_reminder',
    'Subscription Renewal Reminder',
    'financial',
    'high',
    true,
    ch(),
  ),
  evt(
    'subscription_winback',
    'Subscription Win-back',
    'financial',
    'low',
    true,
    ch(),
  ),
  // ── Inventory ─────────────────────────────────────────────────────────────
  evt(
    'medicine_expiring_30_days',
    'Medicine Expiring in 30 Days',
    'inventory',
    'medium',
    true,
    ch(),
  ),
  evt(
    'semen_tank_low_ln2',
    'Semen Tank Low LN2',
    'inventory',
    'high',
    true,
    ch({ sms: true }),
  ),
];

const BY_KEY = new Map(NOTIFICATION_EVENTS.map((e) => [e.key, e]));

export function getEvent(key: string): NotificationEventDef | undefined {
  return BY_KEY.get(key);
}

export function isKnownEvent(key: string): boolean {
  return BY_KEY.has(key);
}

/** The non-`in_app` channels enabled on a set (what the delivery dispatcher handles). */
export function externalChannels(
  channels: NotificationChannels,
): NotificationChannel[] {
  const order: NotificationChannel[] = [
    'push',
    'sms',
    'whatsapp',
    'telegram',
    'email',
  ];
  return order.filter((c) => channels[c]);
}
