/**
 * Milk container / tank selector sheet (WP10 UI/UX redesign).
 * Matches reference design (Select Container bottom sheet).
 * Allows workers to assign or switch destination containers for raw collected milk.
 * ADR-007 compliant: strictly zero drop shadows, 1px/2px border and token fills only.
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
import { TankIcon } from './TankIcon.tsx';

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
      {/* Header: Title + Close Icon */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: tokens.spacing.sm,
        }}
      >
        <SheetTitle>{t('milk.selectContainer')}</SheetTitle>
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

      {/* Tank Cards List */}
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

            const capacityDisplay =
              tank.totalCapacityL && tank.totalCapacityL > 0
                ? t('milk.capacityLabel', { capacity: format.numberSafe(tank.totalCapacityL) })
                : null;

            return (
              <PressableSurface
                key={tank.id}
                accessibilityRole="button"
                accessibilityLabel={`${tank.name} ${capacityDisplay ?? ''}`}
                accessibilityState={{ selected: isSelected }}
                pressedStyle="overlay"
                onPress={() => handleSelect(tank.id)}
                testID={`tank-option-${tank.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: tokens.spacing.sm + 4,
                  paddingHorizontal: tokens.spacing.md,
                  borderRadius: tokens.radius.lg,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  minHeight: tokens.touchTarget.min,
                  gap: tokens.spacing.md,
                }}
              >
                {/* Left: Tank Icon Avatar */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radius.md,
                    backgroundColor: isWithholding ? colors.destructiveTint : colors.muted,
                    borderWidth: 1,
                    borderColor: isWithholding ? colors.destructiveTint : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TankIcon
                    size={20}
                    color={isWithholding ? colors.destructive : colors.primary}
                  />
                </View>

                {/* Middle: Tank Name & Badges */}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
                    <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
                      {tank.name}
                    </Text>
                    {tank.isPrimary ? (
                      <StatusBadge tone="success" label="Primary" />
                    ) : null}
                    {isWithholding ? (
                      <StatusBadge tone="destructive" label={t('milk.withholdingBadge')} />
                    ) : null}
                  </View>
                </View>

                {/* Right: Capacity & Checkmark */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
                  {capacityDisplay ? (
                    <Text role="caption" color="mutedForeground" style={{ fontWeight: '500' }}>
                      {capacityDisplay}
                    </Text>
                  ) : null}

                  {isSelected ? (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: tokens.radius.full,
                        borderWidth: 2,
                        borderColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.card,
                      }}
                    >
                      <Glyph name="check" size={16} color="primary" />
                    </View>
                  ) : null}
                </View>
              </PressableSurface>
            );
          })
        )}
      </View>

      {/* Dismiss action */}
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
