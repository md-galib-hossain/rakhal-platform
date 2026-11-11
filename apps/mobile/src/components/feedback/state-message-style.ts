/**
 * Pure EmptyState / ErrorState resolver (spec 2.10). Token names, copy KEYS and the action rules: no React Native
 * imports, so `node --test` covers it. The component translates the keys; callers' overrides win over the defaults.
 */
import type { MessageKey } from '../../i18n/messages.ts';
import type { AnyColorName } from '../../theme/tokens.ts';
import type { GlyphName } from '../internal/Glyph.tsx';

export const STATE_MESSAGE_METRICS = {
  paddingHorizontal: 24,
  paddingVertical: 32,
  gap: 12,
  disc: 48,
} as const;

export type ErrorKind = 'generic' | 'network' | 'server' | 'session';
export const ERROR_KINDS: readonly ErrorKind[] = ['generic', 'network', 'server', 'session'];

export interface ErrorCopy {
  titleKey: MessageKey;
  /** Generic reuses the shared `common.error.generic` sentence. */
  messageKey: MessageKey;
  glyph: GlyphName;
}

const ERROR_COPY: Readonly<Record<ErrorKind, ErrorCopy>> = {
  generic: { titleKey: 'state.error.generic.title', messageKey: 'common.error.generic', glyph: 'exclamation' },
  network: { titleKey: 'state.error.network.title', messageKey: 'state.error.network.message', glyph: 'exclamation' },
  server: { titleKey: 'state.error.server.title', messageKey: 'state.error.server.message', glyph: 'exclamation' },
  session: { titleKey: 'state.error.session.title', messageKey: 'state.error.session.message', glyph: 'exclamation' },
};

export function errorCopy(kind: ErrorKind = 'generic'): ErrorCopy {
  return ERROR_COPY[kind];
}

export interface DiscColors {
  fill: AnyColorName;
  glyph: AnyColorName;
}

/** Both pairs are listed in contrastPairs (secondaryForeground on secondary, destructiveText on destructiveTint). */
export function discColors(tone: 'empty' | 'error'): DiscColors {
  return tone === 'error'
    ? { fill: 'destructiveTint', glyph: 'destructiveText' }
    : { fill: 'secondary', glyph: 'secondaryForeground' };
}

export const DEFAULT_EMPTY_GLYPH: GlyphName = 'info';

export type ErrorActionPlan = { kind: 'none' } | { kind: 'retry'; loading: boolean } | { kind: 'action' };

/** `action` replaces retry; retry needs `onRetry`; `retrying` only means anything for the retry button. */
export function errorActionPlan(input: { hasAction: boolean; hasRetry: boolean; retrying?: boolean }): ErrorActionPlan {
  if (input.hasAction) return { kind: 'action' };
  if (input.hasRetry) return { kind: 'retry', loading: input.retrying === true };
  return { kind: 'none' };
}
