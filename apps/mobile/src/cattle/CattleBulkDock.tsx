/**
 * Bottom Floating Bulk Action Dock for Cattle Multi-Selection.
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation, 48dp touch targets).
 */
import { memo } from 'react';
import { View } from 'react-native';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

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

  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;

  return (
    <View
      testID={testID}
      style={{
        position: 'absolute',
        bottom: tokens.spacing.md,
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
      {/* Top summary row: Count, Select/Deselect All, Close/Cancel */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: tokens.spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
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
          <Text role="label" color="foreground" style={{ fontWeight: '700', fontSize: 14 }}>
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
              paddingVertical: 6,
              paddingHorizontal: tokens.spacing.sm,
              borderRadius: tokens.radius.sm,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 34,
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
              width: 34,
              height: 34,
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

      {/* Actions buttons row */}
      <View style={{ flexDirection: 'row', gap: tokens.spacing.xs, paddingTop: 4 }}>
        {/* 1. Record event (Primary button) */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.recordEvent')}
          pressedStyle="overlay"
          onPress={onRecordEvent}
          testID="bulk-action-record-event"
          style={{
            flex: 1.2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: tokens.touchTarget.min,
            height: tokens.touchTarget.min,
            paddingHorizontal: tokens.spacing.xs,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.primary,
            gap: 4,
          }}
        >
          <Glyph name="check" size={16} color="primaryForeground" />
          <Text role="button" color="primaryForeground" style={{ fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: tokens.touchTarget.min,
            height: tokens.touchTarget.min,
            paddingHorizontal: tokens.spacing.xs,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 4,
          }}
        >
          <Glyph name="info" size={16} color="foreground" />
          <Text role="button" color="foreground" style={{ fontWeight: '600', fontSize: 12 }} numberOfLines={1}>
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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: tokens.touchTarget.min,
            height: tokens.touchTarget.min,
            paddingHorizontal: tokens.spacing.xs,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 4,
          }}
        >
          <Glyph name="plus" size={16} color="foreground" />
          <Text role="button" color="foreground" style={{ fontWeight: '600', fontSize: 12 }} numberOfLines={1}>
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
            flex: 0.9,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: tokens.touchTarget.min,
            height: tokens.touchTarget.min,
            paddingHorizontal: tokens.spacing.xs,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.destructiveTint,
            borderWidth: 1,
            borderColor: colors.destructive,
            gap: 4,
          }}
        >
          <Glyph name="close" size={16} color="destructiveText" />
          <Text role="button" color="destructiveText" style={{ fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
            {t('cattle.bulk.dispose')}
          </Text>
        </PressableSurface>
      </View>
    </View>
  );
});
