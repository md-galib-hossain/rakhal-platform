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
  medicine_expiring_30_days: {
    title: '৩০ দিনের মধ্যে ওষুধের মেয়াদ শেষ হবে',
    message: '{{name}}-এর মেয়াদ {{date}} তারিখে শেষ হবে।',
  },
};
