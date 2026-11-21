/**
 * Vertical Floating Bulk Action Dock for Cattle Multi-Selection.
 * Positioned on the lower right of the screen (matching the user's vertical dock design).
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation, accessible touch targets).
 */
import { memo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { CalendarPlusIcon, Trash2Icon, UserPlusIcon, WarehouseIcon } from './CattleIcons.tsx';

export interface CattleBulkDockProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRecordEvent: () => void;
  onChangeShed: () => void;
  onAddToGroup: () => void;
  onDispose: () => void;
  onCancel: () => void;
  testID?: string;
}

export const CattleBulkDock = memo(function CattleBulkDock({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onRecordEvent,
  onChangeShed,
  onAddToGroup,
  onDispose,
  onCancel,
  testID = 'cattle-bulk-dock',
}: CattleBulkDockProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const insets = useSafeAreaInsets();

  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;
  const bottomOffset = Math.max(tokens.spacing.md, insets.bottom + 12);

  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        right: tokens.spacing.md,
        width: 66,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.full,
        paddingVertical: tokens.spacing.xs + 2,
        paddingHorizontal: 2,
        alignItems: 'center',
        gap: 4,
        zIndex: 100,
      }}
    >
      {/* 1. Selection Counter Badge */}
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 2,
        }}
      >
        <View
          style={{
            backgroundColor: colors.primary,
            minWidth: 26,
            height: 26,
            borderRadius: tokens.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Text role="caption" color="primaryForeground" style={{ fontWeight: '800', fontSize: 12 }}>
            {format.numberSafe(selectedCount)}
          </Text>
        </View>
        <Text
          role="caption"
          color="mutedForeground"
          style={{ fontWeight: '700', fontSize: 9, marginTop: 2, textAlign: 'center' }}
          numberOfLines={1}
          testID="bulk-selected-count"
        >
          {t('cattle.bulk.selectedCount', { count: format.numberSafe(selectedCount) })}
        </Text>
      </View>

      {/* 2. Select All / Deselect All Toggle */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={isAllSelected ? t('cattle.bulk.deselectAll') : t('cattle.bulk.selectAll', { count: format.numberSafe(totalCount) })}
        pressedStyle="overlay"
        onPress={isAllSelected ? onDeselectAll : onSelectAll}
        testID="bulk-select-all-btn"
        style={{
          paddingVertical: 2,
          paddingHorizontal: 6,
          borderRadius: tokens.radius.full,
          backgroundColor: colors.muted,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: 22,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 9 }}>
          {isAllSelected ? t('cattle.bulk.action.none') : t('cattle.bulk.action.all')}
        </Text>
      </PressableSurface>

      {/* Hairline Divider */}
      <View style={{ width: 44, height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

      {/* 3. Action 1: Record Event */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('cattle.bulk.recordEvent')}
        pressedStyle="overlay"
        onPress={onRecordEvent}
        testID="bulk-action-record-event"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          width: 58,
          paddingVertical: 3,
          gap: 2,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.successTint,
            borderWidth: 1,
            borderColor: colors.primaryEdge,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CalendarPlusIcon size={18} color={colors.primary} />
        </View>
        <Text
          role="caption"
          color="primary"
          style={{ fontWeight: '700', fontSize: 9, textAlign: 'center' }}
          numberOfLines={1}
        >
          {t('cattle.bulk.action.event')}
        </Text>
      </PressableSurface>

      {/* 4. Action 2: Change Shed */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('cattle.bulk.changeShed')}
        pressedStyle="overlay"
        onPress={onChangeShed}
        testID="bulk-action-change-shed"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          width: 58,
          paddingVertical: 3,
          gap: 2,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.secondary,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WarehouseIcon size={18} color={colors.foreground} />
        </View>
        <Text
          role="caption"
          color="foreground"
          style={{ fontWeight: '600', fontSize: 9, textAlign: 'center' }}
          numberOfLines={1}
        >
          {t('cattle.bulk.action.shed')}
        </Text>
      </PressableSurface>

      {/* 5. Action 3: Add to Group */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('cattle.bulk.addToGroup')}
        pressedStyle="overlay"
        onPress={onAddToGroup}
        testID="bulk-action-add-to-group"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          width: 58,
          paddingVertical: 3,
          gap: 2,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.secondary,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserPlusIcon size={18} color={colors.foreground} />
        </View>
        <Text
          role="caption"
          color="foreground"
          style={{ fontWeight: '600', fontSize: 9, textAlign: 'center' }}
          numberOfLines={1}
        >
          {t('cattle.bulk.action.group')}
        </Text>
      </PressableSurface>

      {/* 6. Action 4: Dispose */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('cattle.bulk.dispose')}
        pressedStyle="overlay"
        onPress={onDispose}
        testID="bulk-action-dispose"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          width: 58,
          paddingVertical: 3,
          gap: 2,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.destructiveTint,
            borderWidth: 1,
            borderColor: colors.destructive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2Icon size={18} color={colors.destructiveText} />
        </View>
        <Text
          role="caption"
          color="destructiveText"
          style={{ fontWeight: '700', fontSize: 9, textAlign: 'center' }}
          numberOfLines={1}
        >
          {t('cattle.bulk.action.dispose')}
        </Text>
      </PressableSurface>

      {/* Hairline Divider */}
      <View style={{ width: 44, height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

      {/* 7. Close / Cancel Button */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={t('cattle.bulk.cancel')}
        pressedStyle="overlay"
        onPress={onCancel}
        testID="bulk-cancel-btn"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 38,
          width: 58,
          paddingVertical: 2,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="close" size={16} color="foreground" />
        </View>
      </PressableSurface>
    </View>
  );
});
