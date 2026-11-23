import { memo } from 'react';
import { View } from 'react-native';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { FilterIcon } from './notification-icons.tsx';

export interface NotificationFilterTriggerProps {
  activeFilterCount: number;
  onPress: () => void;
  testID?: string;
}

export const NotificationFilterTrigger = memo(function NotificationFilterTrigger({
  activeFilterCount,
  onPress,
  testID = 'notif-filter-trigger',
}: NotificationFilterTriggerProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={t('notif.filters.title')}
      pressedStyle="overlay"
      onPress={onPress}
      testID={testID}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: 36,
        height: 36,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: activeFilterCount > 0 ? colors.primaryEdge : colors.border,
        backgroundColor: activeFilterCount > 0 ? colors.muted : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <FilterIcon
        size={18}
        color={activeFilterCount > 0 ? colors.primary : colors.foreground}
      />
      {activeFilterCount > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor: colors.primary,
            minWidth: 16,
            height: 16,
            borderRadius: tokens.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text
            role="caption"
            color="primaryForeground"
            style={{ fontWeight: '700', fontSize: 9, lineHeight: 11 }}
          >
            {activeFilterCount}
          </Text>
        </View>
      ) : null}
    </PressableSurface>
  );
});
