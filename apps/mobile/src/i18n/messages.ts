/**
 * Message dictionary (spec W2-6, owner decision O11): hand-typed, no i18n library.
 *
 * Shape: two flat objects of dotted-key -> string, i.e. plain JSON-compatible data (no functions, no nesting
 * surprises) so it can later move into namespaced bn.json/en.json like the web app. `en` is the source of
 * truth for the key set; `bn` is typed `Record<MessageKey, string>`, so a missing or extra key is a compile
 * error, and test/messages.test.ts re-checks parity, empty strings and placeholder parity at runtime.
 *
 * Rules: never concatenate translated fragments; use one template with named `{params}` instead.
 * Only WP2 gallery/dev-screen keys and generic strings live here; feature copy arrives with its WP.
 * Pure: no React Native imports (node --test imports this file).
 *
 * NOTE for review: the Bangla wording below is a first draft written by an engineer. Forma / the owner must
 * proof-read it before it is shown to farmers.
 */
import type { Locale } from '@rakhal/domain';

export const en = {
  // generic
  'common.appName': 'Rakhal',
  'common.loading': 'Loading...',
  'common.retry': 'Try again',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.ok': 'OK',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.error.generic': 'Something went wrong. Please try again.',
  'error.root.title': 'Something went wrong',
  // language / digits / theme names (shown in the pickers)
  'language.bn': 'Bangla',
  'language.en': 'English',
  'digits.latn': '1 2 3 (Latin)',
  'digits.beng': '১ ২ ৩ (Bangla)',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  // dev gallery
  'gallery.title': 'Design gallery',
  'gallery.theme': 'Theme',
  'gallery.language': 'Language',
  'gallery.digits': 'Digits',
  'gallery.typography': 'Typography',
  'gallery.formats': 'Number, money and date formats',
  'gallery.fontScale': 'Font size',
  'gallery.sample.long':
    'Milk collected from every cow is recorded twice a day, and the totals are shown for the whole herd.',
  'gallery.sample.conjunct': 'Milk production capacity',
  'gallery.herdCount': '{count} cows in the herd',
  'gallery.greeting': 'Hello, {name}',
} as const;

export type MessageKey = keyof typeof en;

export const bn: Record<MessageKey, string> = {
  'common.appName': 'রাখাল',
  'common.loading': 'লোড হচ্ছে...',
  'common.retry': 'আবার চেষ্টা করুন',
  'common.cancel': 'বাতিল',
  'common.save': 'সংরক্ষণ করুন',
  'common.close': 'বন্ধ করুন',
  'common.ok': 'ঠিক আছে',
  'common.yes': 'হ্যাঁ',
  'common.no': 'না',
  'common.error.generic': 'কিছু একটা ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
  'error.root.title': 'কিছু একটা ভুল হয়েছে',
  'language.bn': 'বাংলা',
  'language.en': 'English',
  'digits.latn': '1 2 3 (ইংরেজি)',
  'digits.beng': '১ ২ ৩ (বাংলা)',
  'theme.system': 'সিস্টেম',
  'theme.light': 'হালকা',
  'theme.dark': 'গাঢ়',
  'gallery.title': 'ডিজাইন গ্যালারি',
  'gallery.theme': 'থিম',
  'gallery.language': 'ভাষা',
  'gallery.digits': 'সংখ্যা',
  'gallery.typography': 'লেখার ধরন',
  'gallery.formats': 'সংখ্যা, টাকা ও তারিখের ধরন',
  'gallery.fontScale': 'লেখার আকার',
  'gallery.sample.long':
    'প্রতিটি গরুর দুধ দিনে দুইবার লিপিবদ্ধ করা হয় এবং পুরো খামারের মোট পরিমাণ দেখানো হয়।',
  'gallery.sample.conjunct': 'দুগ্ধ উৎপাদন ক্ষমতা',
  'gallery.herdCount': 'পালে {count}টি গরু আছে',
  'gallery.greeting': 'স্বাগতম, {name}',
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, bn };

export const MESSAGE_KEYS = Object.keys(en) as MessageKey[];
