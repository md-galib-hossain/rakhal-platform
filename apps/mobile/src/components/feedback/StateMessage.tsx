/**
 * EmptyState and ErrorState (spec 2.10) over one internal `StateMessage`: a centred column with a 48dp disc, a title,
 * optional text and at most one action Button (lg). Presentational only: callers pass formatted strings.
 *
 * - The disc glyph is decorative (hidden); the title carries the meaning.
 * - ErrorState: `accessibilityRole="alert"` + polite live region. `action` replaces the retry button; `retrying`
 *   turns the retry Button into its loading state. `kind` picks default copy (no generic catch-all); `title` /
 *   `message` override it. `staleNote` (caller-formatted) renders above the action.
 * - Fit: free wrapping; `flexGrow: 1` + centred so a parent ScrollView can scroll when text is large.
 */
import { View } from 'react-native';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import { Button, type ButtonVariant } from '../actions/Button.tsx';
import { Glyph, type GlyphName } from '../internal/Glyph.tsx';
import { Text } from '../primitives/Text.tsx';
import {
  DEFAULT_EMPTY_GLYPH,
  STATE_MESSAGE_METRICS,
  discColors,
  errorActionPlan,
  errorCopy,
  type ErrorKind,
} from './state-message-style.ts';

export type { ErrorKind };

interface StateAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
}

interface StateMessageProps {
  tone: 'empty' | 'error';
  glyph: GlyphName;
  title: string;
  message?: string;
  staleNote?: string;
  action?: StateAction & { loading?: boolean };
  testID?: string;
}

function StateMessage({ tone, glyph, title, message, staleNote, action, testID }: StateMessageProps) {
  const { colors } = useTheme();
  const disc = discColors(tone);
  const isError = tone === 'error';

  return (
    <View
      testID={testID}
      accessibilityRole={isError ? 'alert' : undefined}
      accessibilityLiveRegion={isError ? 'polite' : undefined}
      style={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: STATE_MESSAGE_METRICS.paddingHorizontal,
        paddingVertical: STATE_MESSAGE_METRICS.paddingVertical,
        gap: STATE_MESSAGE_METRICS.gap,
      }}
    >
      <View
        testID="state-disc"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: STATE_MESSAGE_METRICS.disc,
          height: STATE_MESSAGE_METRICS.disc,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors[disc.fill],
        }}
      >
        <Glyph name={glyph} size={24} color={disc.glyph} />
      </View>
      <Text role="title" color="foreground" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message !== undefined && message !== '' ? (
        <Text role="body" color="mutedForeground" style={{ textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
      {staleNote !== undefined && staleNote !== '' ? (
        <Text testID="state-stale-note" role="label" color="mutedForeground" style={{ textAlign: 'center' }}>
          {staleNote}
        </Text>
      ) : null}
      {action ? (
        <Button
          testID="state-action"
          label={action.label}
          onPress={action.onPress}
          variant={action.variant ?? 'primary'}
          size="lg"
          loading={action.loading}
        />
      ) : null}
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: GlyphName;
  action?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' };
  testID?: string;
}

export function EmptyState({ title, description, icon = DEFAULT_EMPTY_GLYPH, action, testID }: EmptyStateProps) {
  return <StateMessage tone="empty" glyph={icon} title={title} message={description} action={action} testID={testID} />;
}

export interface ErrorStateProps {
  /** Picks default copy and glyph (default `generic`). */
  kind?: ErrorKind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Replaces retry (e.g. session -> "Sign in"). */
  action?: { label: string; onPress: () => void };
  /** Caller-formatted, e.g. "Showing data saved at 10:30". */
  staleNote?: string;
  testID?: string;
}

export function ErrorState({ kind = 'generic', title, message, onRetry, retrying, action, staleNote, testID }: ErrorStateProps) {
  const { t } = useLocale();
  const copy = errorCopy(kind);
  const plan = errorActionPlan({ hasAction: action !== undefined, hasRetry: onRetry !== undefined, retrying });

  const resolvedAction =
    plan.kind === 'action' && action
      ? { label: action.label, onPress: action.onPress, variant: 'primary' as const }
      : plan.kind === 'retry' && onRetry
        ? { label: t('common.retry'), onPress: onRetry, variant: 'primary' as const, loading: plan.loading }
        : undefined;

  return (
    <StateMessage
      tone="error"
      glyph={copy.glyph}
      title={title ?? t(copy.titleKey)}
      message={message ?? t(copy.messageKey)}
      staleNote={staleNote}
      action={resolvedAction}
      testID={testID}
    />
  );
}
