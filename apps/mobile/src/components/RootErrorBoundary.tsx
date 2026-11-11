/**
 * Root error boundary. Sits inside the providers (app/_layout.tsx) so the fallback can use the theme tokens and
 * the active locale. Catches render/lifecycle errors of the whole tree below it, logs them, and offers a retry
 * that resets the boundary (re-mounting the children). It cannot catch errors in event handlers or async code.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { Heading, Text } from './primitives/Text.tsx';

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: tokens.spacing.xxl,
        gap: tokens.spacing.md,
        backgroundColor: colors.background,
      }}
    >
      <Heading>{t('error.root.title')}</Heading>
      <Text color="mutedForeground">{t('common.error.generic')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={{
          minHeight: tokens.touchTarget.min,
          alignSelf: 'flex-start',
          justifyContent: 'center',
          paddingHorizontal: tokens.spacing.xl,
          borderRadius: tokens.radius.md,
          backgroundColor: colors.primary,
        }}
      >
        <Text color="primaryForeground" weight="semibold">
          {t('common.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

interface State {
  error: Error | null;
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[root] uncaught render error', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error !== null) return <ErrorFallback onRetry={this.reset} />;
    return this.props.children;
  }
}
