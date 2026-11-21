/**
 * Bottom Floating Bulk Action Dock for Cattle Multi-Selection.
 * Renders actions in a clean vertical stack for optimal mobile thumb reach and zero truncation.
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation, 48dp touch targets).
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
  const bottomInset = Math.max(tokens.spacing.md, insets.bottom + 8);

  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        bottom: bottomInset,
        left: tokens.spacing.md,
        right: tokens.spacing.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.sm,
        gap: tokens.spacing.xs,
        zIndex: 100,
      }}
    >
      {/* Top summary row: Selection Counter, Select All / Deselect All, Close Button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: tokens.spacing.xs,
          paddingVertical: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              backgroundColor: colors.primary,
              minWidth: 22,
              height: 22,
              borderRadius: tokens.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
            }}
          >
            <Text role="caption" color="primaryForeground" style={{ fontWeight: '700', fontSize: 11 }}>
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
              paddingVertical: 4,
              paddingHorizontal: tokens.spacing.sm,
              borderRadius: tokens.radius.sm,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 30,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 11 }}>
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
              width: 30,
              height: 30,
              borderRadius: tokens.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Glyph name="close" size={16} color="foreground" />
          </PressableSurface>
        </View>
      </View>

      {/* 1px Subtle Divider */}
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />

      {/* Vertical Action Rows */}
      <View style={{ gap: 6, paddingTop: 2 }}>
        {/* 1. Record event (Primary Action) */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.recordEvent')}
          pressedStyle="overlay"
          onPress={onRecordEvent}
          testID="bulk-action-record-event"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 46,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 8,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.successTint,
            borderWidth: 1,
            borderColor: colors.primaryEdge,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
            <CalendarPlusIcon size={20} color={colors.primary} />
            <Text role="button" color="primary" style={{ fontWeight: '700', fontSize: 14 }}>
              {t('cattle.bulk.recordEvent')}
            </Text>
          </View>
          <Glyph name="chevronRight" size={16} color="primary" />
        </PressableSurface>

        {/* 2. Change shed */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.changeShed')}
          pressedStyle="overlay"
          onPress={onChangeShed}
          testID="bulk-action-change-shed"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 46,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 8,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
            <WarehouseIcon size={20} color={colors.foreground} />
            <Text role="button" color="foreground" style={{ fontWeight: '600', fontSize: 14 }}>
              {t('cattle.bulk.changeShed')}
            </Text>
          </View>
          <Glyph name="chevronRight" size={16} color="mutedForeground" />
        </PressableSurface>

        {/* 3. Add to group */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.addToGroup')}
          pressedStyle="overlay"
          onPress={onAddToGroup}
          testID="bulk-action-add-to-group"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 46,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 8,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
            <UserPlusIcon size={20} color={colors.foreground} />
            <Text role="button" color="foreground" style={{ fontWeight: '600', fontSize: 14 }}>
              {t('cattle.bulk.addToGroup')}
            </Text>
          </View>
          <Glyph name="chevronRight" size={16} color="mutedForeground" />
        </PressableSurface>

        {/* 4. Dispose (Destructive Action) */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.dispose')}
          pressedStyle="overlay"
          onPress={onDispose}
          testID="bulk-action-dispose"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 46,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 8,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.destructiveTint,
            borderWidth: 1,
            borderColor: colors.destructive,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
            <Trash2Icon size={20} color={colors.destructiveText} />
            <Text role="button" color="destructiveText" style={{ fontWeight: '700', fontSize: 14 }}>
              {t('cattle.bulk.dispose')}
            </Text>
          </View>
          <Glyph name="chevronRight" size={16} color="destructiveText" />
        </PressableSurface>
      </View>
    </View>
  );
});
