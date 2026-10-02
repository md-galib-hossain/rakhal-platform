import { notificationEn } from './notification.en';

/** Bangla catalogue — draft for review; keys/placeholders must mirror `notificationEn`. */
export const notificationBn: typeof notificationEn = {
  animal_sickness_reported: {
    title: 'পশুর অসুস্থতার তথ্য পাওয়া গেছে',
    message:
      '{{name}} ({{tagNumber}}) — {{diagnosis}} রিপোর্ট করা হয়েছে (গুরুত্ব: {{priority}})।',
  },
  low_medicine_stock: {
    title: 'ওষুধের মজুদ কম',
    message: '{{name}} কম আছে: {{balance}} বাকি (সতর্কতা সীমা {{threshold}})।',
  },
  calving_expected_3_days: {
    title: '৩ দিনের মধ্যে বাছুর প্রসবের সম্ভাবনা',
    message: '{{name}} ({{tagNumber}}) {{date}} তারিখে বাছুর প্রসব করতে পারে।',
  },
  payment_overdue: {
    title: 'পরিশোধের মেয়াদ পার হয়ে গেছে',
    message:
      '{{entityName}}-এর পরিশোধ বকেয়া: ৳{{amount}} ({{date}} তারিখে দেয় ছিল)।',
  },
  task_overdue: {
    title: 'কাজের মেয়াদ শেষ',
    message:
      '"{{name}}" কাজটি {{date}} তারিখে শেষ হওয়ার কথা ছিল, এখনও সম্পন্ন হয়নি।',
  },
  health_task_reminder: {
    title: '{{days}} দিন পর স্বাস্থ্য কাজ',
    message: '{{label}}: {{count}}টি পশু, তারিখ {{date}}।',
  },
  health_task_due_tomorrow: {
    title: 'আগামীকাল স্বাস্থ্য কাজ',
    message: '{{label}}: {{count}}টি পশু, তারিখ {{date}}।',
  },
  health_task_due_today: {
    title: 'আজ স্বাস্থ্য কাজ',
    message: '{{label}}: {{count}}টি পশু, আজ ({{date}})।',
  },
  health_task_overdue: {
    title: 'স্বাস্থ্য কাজের সময় পেরিয়ে গেছে',
    message: '{{label}}: {{count}}টি পশু, {{date}} থেকে বকেয়া।',
  },
  medicine_expiring_30_days: {
    title: '৩০ দিনের মধ্যে ওষুধের মেয়াদ শেষ হবে',
    message: '{{name}}-এর মেয়াদ {{date}} তারিখে শেষ হবে।',
  },
  withholding_active: {
    title: 'অপেক্ষার মেয়াদ চলছে',
    message:
      '{{name}} ({{tagNumber}}) অপেক্ষার মেয়াদে আছে। দুধ নিরাপদ {{milkUntil}} থেকে। মাংস নিরাপদ {{meatUntil}} থেকে।',
  },
  cow_expected_in_heat: {
    title: 'গাভীর মদন আসার সম্ভাবনা',
    message:
      '{{name}} ({{tagNumber}})-এর মদন আসার সম্ভাবনা (সর্বশেষ মদন {{date}})।',
  },
  pregnancy_check_due: {
    title: 'গর্ভধারণ পরীক্ষার সময় হয়েছে',
    message:
      '{{name}} ({{tagNumber}})-এর গর্ভধারণ পরীক্ষা বাকি (প্রত্যাশিত {{date}})।',
  },
  dry_off_due_14_days: {
    title: '১৪ দিনের মধ্যে দুধ বন্ধের সময়',
    message:
      '{{name}} ({{tagNumber}}) দুধ বন্ধের কাছাকাছি (দিন {{day}} এর মধ্যে {{target}})।',
  },
  supplier_payment_due_soon: {
    title: 'সরবরাহকারীর পরিশোধ শীঘ্রই',
    message:
      '{{entityName}}-এর পরিশোধ শীঘ্রই দিতে হবে: ৳{{amount}} ({{date}} তারিখে দেয়)।',
  },
  survival_runway_warning: {
    title: 'টিকে থাকার সময়সীমা সতর্কতা',
    message:
      'নগদ অর্থের সময়সীমা {{status}} — বর্তমান খরচে প্রায় {{days}} দিন বাকি।',
  },
  semen_tank_low_ln2: {
    title: 'সিমেন ট্যাংকের LN2 কম',
    message: '{{name}}-এর LN2 লেভেল কম ({{level}}%)।',
  },
  todays_tasks_ready: {
    title: 'আজকের কাজ প্রস্তুত',
    message: 'আজ আপনার {{count}}টি কাজ বাকি আছে।',
  },
  morbidity_outbreak: {
    title: 'রোগ প্রাদুর্ভাবের সতর্কতা',
    message:
      'গত ৪৮ ঘণ্টায় {{herd}}টি পশুর মধ্যে {{sick}}টি ({{pct}}%) অসুস্থ হয়েছে।',
  },
};
