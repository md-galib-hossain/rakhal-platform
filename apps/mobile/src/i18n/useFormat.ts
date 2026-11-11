/**
 * Hook returning formatters bound to the current locale and digit system (see formatters.ts).
 * Memoised on (locale, digits), so the object is referentially stable across unrelated renders.
 */
import { useMemo } from 'react';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { bindFormatters, type Formatters } from './formatters.ts';

export type { Formatters } from './formatters.ts';

export function useFormat(): Formatters {
  const { locale, digits } = useLocale();
  return useMemo(() => bindFormatters(locale, digits), [locale, digits]);
}
