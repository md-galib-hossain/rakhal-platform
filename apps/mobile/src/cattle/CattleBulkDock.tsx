/**
 * Bottom Floating Bulk Action Dock for Cattle Multi-Selection.
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation, 48dp+ touch targets).
 * Provides vertical action tiles to prevent text truncation in both English and Bangla.
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

  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        bottom: Math.max(tokens.spacing.md, insets.bottom + 8),
        left: tokens.spacing.md,
        right: tokens.spacing.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        paddingTop: tokens.spacing.xs + 2,
        paddingBottom: tokens.spacing.sm,
        paddingHorizontal: tokens.spacing.xs,
        zIndex: 100,
      }}
    >
      {/* Top summary row: Count, Select/Deselect All, Close/Cancel */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: tokens.spacing.xs,
          paddingBottom: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs + 2 }}>
          <View
            style={{
              backgroundColor: colors.primary,
              minWidth: 24,
              height: 24,
              borderRadius: tokens.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text role="caption" color="primaryForeground" style={{ fontWeight: '700', fontSize: 12 }}>
              {format.numberSafe(selectedCount)}
            </Text>
          </View>
          <Text role="label" color="foreground" style={{ fontWeight: '700', fontSize: 13 }}>
            {t('cattle.bulk.selectedCount', { count: format.numberSafe(selectedCount) })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={isAllSelected ? t('cattle.bulk.deselectAll') : t('cattle.bulk.selectAll', { count: format.numberSafe(totalCount) })}
            pressedStyle="overlay"
            onPress={isAllSelected ? onDeselectAll : onSelectAll}
            testID="bulk-select-all-btn"
            style={{
              paddingVertical: 5,
              paddingHorizontal: tokens.spacing.sm,
              borderRadius: tokens.radius.full,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
              {isAllSelected ? t('cattle.bulk.deselectAll') : t('cattle.bulk.selectAll', { count: format.numberSafe(totalCount) })}
            </Text>
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('cattle.bulk.cancel')}
            pressedStyle="overlay"
            onPress={onCancel}
            testID="bulk-cancel-btn"
            style={{
              width: 32,
              height: 32,
              borderRadius: tokens.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Glyph name="close" size={16} color="foreground" />
          </PressableSurface>
        </View>
      </View>

      {/* Hairline divider between control strip and action tiles */}
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: tokens.spacing.xs, marginBottom: 6 }} />

      {/* 4 Action Columns (vertical icon tile + text) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        {/* 1. Record event */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.recordEvent')}
          pressedStyle="overlay"
          onPress={onRecordEvent}
          testID="bulk-action-record-event"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 68,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 2,
            borderRadius: tokens.radius.md,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.successTint,
              borderWidth: 1,
              borderColor: colors.primaryEdge,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <CalendarPlusIcon size={20} color={colors.primaryEdge} />
          </View>
          <Text
            role="caption"
            color="foreground"
            style={{ fontWeight: '600', fontSize: 11, lineHeight: 14, textAlign: 'center' }}
            numberOfLines={2}
          >
            {t('cattle.bulk.recordEvent')}
          </Text>
        </PressableSurface>

        {/* 2. Change shed */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.changeShed')}
          pressedStyle="overlay"
          onPress={onChangeShed}
          testID="bulk-action-change-shed"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 68,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 2,
            borderRadius: tokens.radius.md,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <WarehouseIcon size={20} color={colors.foreground} />
          </View>
          <Text
            role="caption"
            color="foreground"
            style={{ fontWeight: '600', fontSize: 11, lineHeight: 14, textAlign: 'center' }}
            numberOfLines={2}
          >
            {t('cattle.bulk.changeShed')}
          </Text>
        </PressableSurface>

        {/* 3. Add to group */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.addToGroup')}
          pressedStyle="overlay"
          onPress={onAddToGroup}
          testID="bulk-action-add-to-group"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 68,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 2,
            borderRadius: tokens.radius.md,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <UserPlusIcon size={20} color={colors.foreground} />
          </View>
          <Text
            role="caption"
            color="foreground"
            style={{ fontWeight: '600', fontSize: 11, lineHeight: 14, textAlign: 'center' }}
            numberOfLines={2}
          >
            {t('cattle.bulk.addToGroup')}
          </Text>
        </PressableSurface>

        {/* 4. Dispose */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.dispose')}
          pressedStyle="overlay"
          onPress={onDispose}
          testID="bulk-action-dispose"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 68,
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 2,
            borderRadius: tokens.radius.md,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.destructiveTint,
              borderWidth: 1,
              borderColor: colors.destructive,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <Trash2Icon size={20} color={colors.destructiveText} />
          </View>
          <Text
            role="caption"
            color="destructiveText"
            style={{ fontWeight: '600', fontSize: 11, lineHeight: 14, textAlign: 'center' }}
            numberOfLines={2}
          >
            {t('cattle.bulk.dispose')}
          </Text>
        </PressableSurface>
      </View>
    </View>
  );
});
