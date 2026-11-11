/**
 * Pure message lookup + interpolation (spec W2-6). No React Native imports (node --test imports this file).
 *
 * Missing-key behaviour (documented + tested):
 *   1. look the key up in the active locale; an absent or empty string counts as missing;
 *   2. fall back to the English string (reported as 'fallback-en');
 *   3. if English is missing too, return the key itself (reported as 'missing') so the gap is visible, never blank.
 * `onMissing` is how the caller warns; the provider wires it to console.warn in dev only. This function never throws.
 *
 * Interpolation: `{name}` placeholders, replaced from `params` (numbers via String(); pre-format anything that needs
 * grouping, fractions or Bangla digits with useFormat). A placeholder with no param is left untouched, so a bug shows.
 */
import type { Locale } from '@rakhal/domain';
import { messages, type MessageKey } from './messages.ts';

export type MessageParams = Readonly<Record<string, string | number>>;
export type MissingKind = 'fallback-en' | 'missing';
export type OnMissing = (key: string, locale: Locale, kind: MissingKind) => void;

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, params?: MessageParams): string {
  if (params === undefined) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** Placeholder names used by a template, in first-seen order without duplicates. */
export function placeholdersOf(template: string): string[] {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1] as string;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: MessageParams,
  onMissing?: OnMissing,
): string {
  const dictionaries = messages as Record<Locale, Partial<Record<string, string>>>;
  const own = dictionaries[locale][key];
  if (own !== undefined && own !== '') return interpolate(own, params);
  const english = dictionaries.en[key];
  if (english !== undefined && english !== '') {
    onMissing?.(key, locale, 'fallback-en');
    return interpolate(english, params);
  }
  onMissing?.(key, locale, 'missing');
  return key;
}
