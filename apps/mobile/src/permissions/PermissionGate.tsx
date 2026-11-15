/**
 * PermissionGate (WP6): renders `children` only when the account holds `permission` for the active farm
 * (`null` = no requirement). While permissions are not known yet it shows a loader (never the content, never a guess);
 * when they are known and insufficient it shows a plain "no access" state, or `fallback`.
 *
 * Used on every tab screen so a deep link cannot bypass the tab bar, and for controls inside screens. The server still
 * enforces every request: this only decides what the UI offers.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { EmptyState } from '../components/feedback/StateMessage.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { can } from './can.ts';

export interface PermissionGateProps {
  permission: string | null;
  children: ReactNode;
  /** Shown instead of the default "no access" state when permissions are known and insufficient. */
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const { permissions } = useAuth();
  const { t } = useLocale();
  const { colors } = useTheme();

  if (can(permissions, permission)) return <>{children}</>;

  if (permissions === null) {
    return (
      <View
        testID="permission-loading"
        accessibilityLabel={t('a11y.loading')}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState
        icon="info"
        title={t('access.denied.title')}
        description={t('access.denied.message')}
        testID="permission-denied"
      />
    </View>
  );
}
