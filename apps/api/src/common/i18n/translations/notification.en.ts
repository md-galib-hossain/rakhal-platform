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
  medicine_expiring_30_days: {
    title: 'Medicine Expiring in 30 Days',
    message: '{{name}} expires on {{date}}.',
  },
};
