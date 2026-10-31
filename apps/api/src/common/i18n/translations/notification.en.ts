/**
 * Localized title/message templates for the notification events that emit
 * with structured `params` (RAKHAL-107). `{{token}}` placeholders are filled
 * by `I18nService.translate`. Events not listed here keep the literal
 * `title`/`message` the caller passed (unmigrated — see notification.service.ts).
 */
export const notificationEn = {
  animal_sickness_reported: {
    title: 'Animal Sickness Reported',
    message:
      '{{name}} ({{tagNumber}}) — {{diagnosis}} reported (priority: {{priority}}).',
  },
  low_medicine_stock: {
    title: 'Low Medicine Stock',
    message:
      '{{name}} is low: {{balance}} left (alert threshold {{threshold}}).',
  },
  calving_expected_3_days: {
    title: 'Calving Expected in 3 Days',
    message: '{{name}} ({{tagNumber}}) is expected to calve on {{date}}.',
  },
  payment_overdue: {
    title: 'Payment Overdue',
    message: '{{entityName}} is overdue: ৳{{amount}} (due {{date}}).',
  },
  task_overdue: {
    title: 'Task Overdue',
    message: '"{{name}}" was due {{date}} and is not complete.',
  },
  bulk_event_recorded: {
    title: 'Bulk event recorded',
    message: '{{type}}: {{saved}} of {{requested}} animals recorded.',
  },
  follow_up_upcoming: {
    title: 'Coming up in {{days}} day(s): {{label}}',
    message: '{{label}}: {{animals}}, due {{date}}.',
  },
  follow_up_due_today: {
    title: 'Due today: {{label}}',
    message: '{{label}}: {{animals}}, due today ({{date}}).',
  },
  follow_up_overdue: {
    title: 'Overdue: {{label}}',
    message: '{{label}}: {{animals}}, overdue since {{date}}.',
  },
  health_task_reminder: {
    title: 'Health Step Due in {{days}} Days',
    message: '{{label}}: {{count}} animal(s), due {{date}}.',
  },
  health_task_due_tomorrow: {
    title: 'Health Step Due Tomorrow',
    message: '{{label}}: {{count}} animal(s), due {{date}}.',
  },
  health_task_due_today: {
    title: 'Health Step Due Today',
    message: '{{label}}: {{count}} animal(s), due today ({{date}}).',
  },
  health_task_overdue: {
    title: 'Health Step Overdue',
    message: '{{label}}: {{count}} animal(s) overdue since {{date}}.',
  },
  medicine_expiring_30_days: {
    title: 'Medicine Expiring in 30 Days',
    message: '{{name}} expires on {{date}}.',
  },
  withholding_active: {
    title: 'Withholding Period Active',
    message:
      '{{name}} ({{tagNumber}}) is under withdrawal. Milk safe from {{milkUntil}}. Meat safe from {{meatUntil}}.',
  },
  cow_expected_in_heat: {
    title: 'Cow Expected in Heat',
    message:
      '{{name}} ({{tagNumber}}) is expected back in heat (last heat {{date}}).',
  },
  pregnancy_check_due: {
    title: 'Pregnancy Check Due',
    message:
      '{{name}} ({{tagNumber}}) is due for a pregnancy check (expected {{date}}).',
  },
  dry_off_due_14_days: {
    title: 'Dry-Off Due in 14 Days',
    message:
      '{{name}} ({{tagNumber}}) is approaching dry-off (day {{day}} of {{target}}).',
  },
  supplier_payment_due_soon: {
    title: 'Supplier Payment Due Soon',
    message: '{{entityName}} is due soon: ৳{{amount}} (due {{date}}).',
  },
  survival_runway_warning: {
    title: 'Survival Runway Warning',
    message:
      'Cash runway is {{status}} — about {{days}} day(s) left at current spend.',
  },
  semen_tank_low_ln2: {
    title: 'Semen Tank Low LN2',
    message: "{{name}}'s LN2 level is low ({{level}}%).",
  },
  todays_tasks_ready: {
    title: "Today's Tasks Ready",
    message: 'You have {{count}} task(s) due today.',
  },
  morbidity_outbreak: {
    title: 'Morbidity Outbreak Alert',
    message:
      '{{sick}} of {{herd}} animals ({{pct}}%) reported sick in the last 48 hours.',
  },
};
