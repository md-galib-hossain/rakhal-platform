/**
 * Milk tank selector sheet (WP10 UI/UX overhaul).
 * Allows workers to view and select the active milk storage tank.
 * Withheld milk is automatically routed to the withholding tank.
 */
import { View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export interface MilkTankOption {
  id: string;
  name: string;
  tankType: 'SELLABLE' | 'WITHHOLDING' | string;
  totalCapacityL?: number | null;
  currentVolumeL?: number | null;
  isPrimary?: boolean;
}

export interface TankSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  tanks: MilkTankOption[];
  selectedTankId: string | null;
  onSelectTank: (tankId: string) => void;
  testID?: string;
}

export function TankSelectorSheet({
  visible,
  onClose,
  tanks,
  selectedTankId,
  onSelectTank,
  testID = 'tank-selector-sheet',
}: TankSelectorSheetProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const handleSelect = (id: string) => {
    onSelectTank(id);
    onClose();
  };

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: tokens.spacing.xs,
        }}
      >
        <SheetTitle>{t('milk.selectTank')}</SheetTitle>
        <IconButton
          icon="close"
          accessibilityLabel={t('picker.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID="tank-selector-close"
        />
      </View>

      {/* Auto-routing info notice */}
      <View
        testID="tank-auto-route-notice"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.xs,
          padding: tokens.spacing.sm,
          borderRadius: tokens.radius.md,
          backgroundColor: colors.muted,
          marginBottom: tokens.spacing.md,
        }}
      >
        <Glyph name="info" size={16} color="infoText" />
        <Text role="caption" color="mutedForeground" style={{ flex: 1 }}>
          {t('milk.tankAutoRoute')}
        </Text>
      </View>

      {/* Tank List */}
      <View style={{ gap: tokens.spacing.sm }}>
        {tanks.length === 0 ? (
          <View
            style={{
              padding: tokens.spacing.md,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text role="body" color="mutedForeground">
              {t('milk.tankSellable')} (Default)
            </Text>
          </View>
        ) : (
          tanks.map((tank) => {
            const isSelected = tank.id === selectedTankId;
            const isWithholding = tank.tankType === 'WITHHOLDING';

            const capacityText =
              tank.totalCapacityL && tank.currentVolumeL !== undefined && tank.currentVolumeL !== null
                ? t('milk.tankCapacity', {
                    current: format.numberSafe(tank.currentVolumeL),
                    capacity: format.numberSafe(tank.totalCapacityL),
                  })
                : null;

            return (
              <PressableSurface
                key={tank.id}
                accessibilityRole="button"
                accessibilityLabel={`${tank.name} ${tank.tankType}`}
                accessibilityState={{ selected: isSelected }}
                pressedStyle="overlay"
                onPress={() => handleSelect(tank.id)}
                testID={`tank-option-${tank.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: tokens.spacing.md,
                  paddingHorizontal: tokens.spacing.md,
                  borderRadius: tokens.radius.lg,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primaryEdge : colors.border,
                  backgroundColor: colors.card,
                  minHeight: tokens.touchTarget.min,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
                    <Text role="label" color="foreground">
                      {tank.name}
                    </Text>
                    {tank.isPrimary ? (
                      <StatusBadge tone="success" label="Primary" />
                    ) : null}
                    {isWithholding ? (
                      <StatusBadge tone="destructive" label={t('milk.withholdingBadge')} />
                    ) : null}
                  </View>

                  {capacityText ? (
                    <Text role="caption" color="mutedForeground">
                      {capacityText}
                    </Text>
                  ) : null}
                </View>

                {isSelected ? (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: tokens.radius.full,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Glyph name="check" size={16} color="primaryForeground" />
                  </View>
                ) : null}
              </PressableSurface>
            );
          })
        )}
      </View>

      {/* Close button */}
      <View style={{ marginTop: tokens.spacing.lg }}>
        <Button
          label={t('picker.close')}
          variant="secondary"
          size="md"
          onPress={onClose}
          testID="tank-selector-dismiss"
        />
      </View>
    </SheetModal>
  );
}
