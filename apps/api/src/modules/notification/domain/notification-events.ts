/**
 * Notification event catalogue (PRD §20.2) — the single source of truth for
 * which events exist, their category/priority, whether a user may disable them,
 * and the default delivery channels. Pure data; no framework/Prisma imports.
 *
 * Health & Safety events are **always sent and cannot be disabled** (PRD §20.2).
 * SMS/WhatsApp/Email delivery is gated behind a provider seam that is stubbed
 * until a provider is chosen (RAKHAL-110) — the in-app channel is always live.
 */

export type NotificationCategory =
  | 'health_safety'
  | 'reproduction'
  | 'operational'
  | 'financial'
  | 'inventory';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotificationChannel = 'in_app' | 'sms' | 'whatsapp' | 'email';

export interface NotificationChannels {
  in_app: boolean;
  sms: boolean;
  whatsapp: boolean;
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

const ch = (
  inApp: boolean,
  sms = false,
  whatsapp = false,
  email = false,
): NotificationChannels => ({
  in_app: inApp,
  sms,
  whatsapp,
  email,
});

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  // ── Health & Safety (cannot be disabled) ──────────────────────────────────
  evt(
    'animal_sickness_reported',
    'Animal Sickness Reported',
    'health_safety',
    'critical',
    false,
    ch(true, true),
  ),
  evt(
    'medicine_expired',
    'Medicine Expired',
    'health_safety',
    'high',
    false,
    ch(true, true),
  ),
  evt(
    'withholding_active',
    'Withholding Period Active',
    'health_safety',
    'high',
    false,
    ch(true),
  ),
  evt(
    'withholding_ended',
    'Withholding Period Ended',
    'health_safety',
    'medium',
    false,
    ch(true),
  ),
  evt(
    'morbidity_outbreak',
    'Morbidity Outbreak Alert',
    'health_safety',
    'critical',
    false,
    ch(true, true),
  ),
  // ── Reproduction ──────────────────────────────────────────────────────────
  evt(
    'calving_expected_3_days',
    'Calving Expected in 3 Days',
    'reproduction',
    'high',
    true,
    ch(true, true),
  ),
  evt(
    'cow_expected_in_heat',
    'Cow Expected in Heat',
    'reproduction',
    'medium',
    true,
    ch(true),
  ),
  evt(
    'pregnancy_check_due',
    'Pregnancy Check Due',
    'reproduction',
    'medium',
    true,
    ch(true),
  ),
  evt(
    'vwp_complete_ready_ai',
    'VWP Complete — Ready for AI',
    'reproduction',
    'medium',
    true,
    ch(true),
  ),
  evt(
    'dry_off_due_14_days',
    'Dry-Off Due in 14 Days',
    'reproduction',
    'medium',
    true,
    ch(true),
  ),
  // ── Operational ───────────────────────────────────────────────────────────
  evt(
    'low_medicine_stock',
    'Low Medicine Stock',
    'operational',
    'medium',
    true,
    ch(true),
  ),
  evt(
    'low_feed_stock',
    'Low Feed Stock',
    'operational',
    'medium',
    true,
    ch(true),
  ),
  evt(
    'daily_milk_log_reminder',
    'Daily Milk Log Reminder',
    'operational',
    'medium',
    true,
    ch(true, true),
  ),
  evt('task_overdue', 'Task Overdue', 'operational', 'medium', true, ch(true)),
  evt(
    'safety_critical_task_overdue',
    'Safety Critical Task Overdue',
    'operational',
    'high',
    false,
    ch(true, true),
  ),
  evt(
    'todays_tasks_ready',
    "Today's Tasks Ready",
    'operational',
    'low',
    true,
    ch(true),
  ),
  // ── Financial ─────────────────────────────────────────────────────────────
  evt(
    'payment_overdue',
    'Payment Overdue',
    'financial',
    'high',
    true,
    ch(true, true),
  ),
  evt(
    'survival_runway_warning',
    'Survival Runway Warning',
    'financial',
    'high',
    true,
    ch(true, true),
  ),
  evt(
    'supplier_payment_due_soon',
    'Supplier Payment Due Soon',
    'financial',
    'medium',
    true,
    ch(true),
  ),
  // ── Inventory ─────────────────────────────────────────────────────────────
  evt(
    'medicine_expiring_30_days',
    'Medicine Expiring in 30 Days',
    'inventory',
    'medium',
    true,
    ch(true),
  ),
  evt(
    'semen_tank_low_ln2',
    'Semen Tank Low LN2',
    'inventory',
    'high',
    true,
    ch(true, true),
  ),
];

function evt(
  key: string,
  label: string,
  category: NotificationCategory,
  priority: NotificationPriority,
  canDisable: boolean,
  defaultChannels: NotificationChannels,
): NotificationEventDef {
  return { key, label, category, priority, canDisable, defaultChannels };
}

const BY_KEY = new Map(NOTIFICATION_EVENTS.map((e) => [e.key, e]));

export function getEvent(key: string): NotificationEventDef | undefined {
  return BY_KEY.get(key);
}

export function isKnownEvent(key: string): boolean {
  return BY_KEY.has(key);
}

/** The non-`in_app` channels enabled on a channel set (what the delivery seam handles). */
export function externalChannels(
  channels: NotificationChannels,
): NotificationChannel[] {
  const out: NotificationChannel[] = [];
  if (channels.sms) out.push('sms');
  if (channels.whatsapp) out.push('whatsapp');
  if (channels.email) out.push('email');
  return out;
}
