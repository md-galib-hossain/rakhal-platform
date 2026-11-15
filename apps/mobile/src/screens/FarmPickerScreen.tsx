/**
 * Farm picker (WP5d). Route: `/farm`. Used right after sign-in when the account has no active farm yet
 * (`needsFarm`), and later from home to switch farm.
 *
 * The list comes from the login response when the account had two or more farms; otherwise (cold start, or opened
 * from home) it is loaded with `GET /farms`. Choosing a farm calls `switchFarm` (a token refresh scoped to that farm;
 * the server checks membership) and then goes home. An account with no farm gets an empty state: creating a farm is a
 * web flow, so the only action offered here is to sign out.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, NetworkError, type FarmSummary } from '@rakhal/api-client';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { SkeletonList } from '../components/display/Skeleton.tsx';
import { ListRow } from '../components/display/ListRow.tsx';
import { EmptyState, ErrorState, type ErrorKind } from '../components/feedback/StateMessage.tsx';
import { Heading, Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

type LoadState = 'loading' | 'ready' | 'error';

function errorKindOf(error: unknown): ErrorKind {
  if (error instanceof NetworkError) return 'network';
  if (error instanceof ApiError && error.status >= 500) return 'server';
  return 'generic';
}

export function FarmPickerScreen() {
  const { farms: loginFarms, client, switchFarm, signOut, farmId } = useAuth();
  const { t } = useLocale();
  const { tokens, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [farms, setFarms] = useState<FarmSummary[] | null>(loginFarms);
  const [state, setState] = useState<LoadState>(loginFarms ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState('loading');
    try {
      const result = await client.get<FarmSummary[]>('/farms');
      setFarms(result.data);
      setState('ready');
    } catch (error) {
      setLoadError(error);
      setState('error');
    }
  }, [client]);

  useEffect(() => {
    if (!loginFarms) void load();
  }, [loginFarms, load]);

  async function choose(id: string) {
    if (switchingId) return;
    setSwitchError(undefined);
    setSwitchingId(id);
    try {
      await switchFarm(id);
      router.replace('/');
    } catch {
      setSwitchError(t('farm.error.switch'));
      setSwitchingId(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + tokens.spacing.xxl,
        paddingBottom: insets.bottom + tokens.spacing.xxl,
        paddingLeft: insets.left + tokens.spacing.xl,
        paddingRight: insets.right + tokens.spacing.xl,
        gap: tokens.spacing.lg,
      }}
    >
      <View style={{ gap: tokens.spacing.xs }}>
        <Heading>{t('farm.title')}</Heading>
        <Text color="mutedForeground">{t('farm.subtitle')}</Text>
      </View>

      {state === 'loading' ? <SkeletonList rows={3} /> : null}

      {state === 'error' ? <ErrorState kind={errorKindOf(loadError)} onRetry={() => void load()} /> : null}

      {state === 'ready' && farms && farms.length === 0 ? (
        <EmptyState
          title={t('farm.empty.title')}
          description={t('farm.empty.message')}
          action={{ label: t('home.signOut'), onPress: () => void signOut(), variant: 'secondary' }}
        />
      ) : null}

      {state === 'ready' && farms && farms.length > 0 ? (
        <View testID="farm-list">
          {farms.map((farm) => (
            <ListRow
              key={farm.id}
              title={farm.name}
              subtitle={farm.role}
              selected={farm.id === farmId}
              disabled={switchingId !== null && switchingId !== farm.id}
              onPress={() => void choose(farm.id)}
              divider
              testID={`farm-row-${farm.id}`}
            />
          ))}
        </View>
      ) : null}

      {switchError ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID="farm-switch-error">
          <Text color="destructive">{switchError}</Text>
        </View>
      ) : null}

      {state === 'ready' && farms && farms.length > 0 ? (
        <Button label={t('home.signOut')} variant="ghost" size="md" onPress={() => void signOut()} />
      ) : null}
    </ScrollView>
  );
}
