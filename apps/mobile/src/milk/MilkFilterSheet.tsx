/**
 * Milk filter sheet (WP10, modern search & filter bottom sheet).
 * Inspired by modern grocery/commerce filtering patterns:
 * - Shed selection (All sheds, Shed 1, Shed 2...)
 * - Status selection (All, Milking only, Withheld only)
 * - Tank routing selection (All tanks, Main Tank, Withholding Tank...)
 * - Apply Filter & Reset actions.
 * ADR-007 compliant: strictly zero drop shadows, 1px border and tokens only.
 */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { Chip } from '../components/forms/Chip.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { MilkTankOption } from './TankSelectorSheet.tsx';
import type { ShedFilterOption } from './useMilkScreen.ts';

export type MilkStatusFilter = 'all' | 'milking' | 'withheld';

export interface MilkFilterState {
  selectedShedId: string | null;
  statusFilter: MilkStatusFilter;
  selectedTankId: string | null;
}

export interface MilkFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  sheds: readonly ShedFilterOption[];
  selectedShedId: string | null;
  statusFilter: MilkStatusFilter;
  tanks: readonly MilkTankOption[];
  selectedTankId: string | null;
  onApply: (filters: MilkFilterState) => void;
  onReset: () => void;
  testID?: string;
}

export function MilkFilterSheet({
  visible,
  onClose,
  sheds,
  selectedShedId,
  statusFilter,
  tanks,
  selectedTankId,
  onApply,
  onReset,
  testID = 'milk-filter-sheet',
}: MilkFilterSheetProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();

  const [draftShedId, setDraftShedId] = useState<string | null>(selectedShedId);
  const [draftStatus, setDraftStatus] = useState<MilkStatusFilter>(statusFilter);
  const [draftTankId, setDraftTankId] = useState<string | null>(selectedTankId);

  useEffect(() => {
    if (visible) {
      setDraftShedId(selectedShedId);
      setDraftStatus(statusFilter);
      setDraftTankId(selectedTankId);
    }
  }, [visible, selectedShedId, statusFilter, selectedTankId]);

  const handleApply = () => {
    onApply({
      selectedShedId: draftShedId,
      statusFilter: draftStatus,
      selectedTankId: draftTankId,
    });
    onClose();
  };

  const handleReset = () => {
    setDraftShedId(null);
    setDraftStatus('all');
    setDraftTankId(null);
    onReset();
    onClose();
  };

  const activeCount =
    (draftShedId !== null ? 1 : 0) +
    (draftStatus !== 'all' ? 1 : 0) +
    (draftTankId !== null ? 1 : 0);

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: tokens.spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          <SheetTitle>{t('milk.filterTitle')}</SheetTitle>
          {activeCount > 0 ? (
            <View
              style={{
                backgroundColor: colors.successTint,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: tokens.radius.full,
                borderWidth: 1,
                borderColor: colors.primaryEdge,
              }}
            >
              <Text role="caption" color="foreground" style={{ fontWeight: '700', fontSize: 12 }}>
                {String(activeCount)}
              </Text>
            </View>
          ) : null}
        </View>

        <IconButton
          icon="close"
          accessibilityLabel={t('picker.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID="filter-sheet-close"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: tokens.spacing.lg, paddingBottom: tokens.spacing.lg }}
      >
        {/* Sheds Section */}
        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('milk.filterSheds')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
            <Chip
              label={t('milk.allSheds')}
              selected={draftShedId === null}
              onPress={() => setDraftShedId(null)}
              testID="filter-shed-all"
            />
            {sheds.map((shed) => (
              <Chip
                key={shed.id}
                label={shed.name}
                selected={draftShedId === shed.id}
                onPress={() => setDraftShedId(shed.id)}
                testID={`filter-shed-${shed.id}`}
              />
            ))}
          </View>
        </View>

        {/* Status Section */}
        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('milk.filterStatus')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
            <Chip
              label={t('milk.statusAll')}
              selected={draftStatus === 'all'}
              onPress={() => setDraftStatus('all')}
              testID="filter-status-all"
            />
            <Chip
              label={t('milk.statusMilking')}
              selected={draftStatus === 'milking'}
              onPress={() => setDraftStatus('milking')}
              testID="filter-status-milking"
            />
            <Chip
              label={t('milk.statusWithheld')}
              selected={draftStatus === 'withheld'}
              onPress={() => setDraftStatus('withheld')}
              testID="filter-status-withheld"
            />
          </View>
        </View>

        {/* Tank Routing Section */}
        {tanks.length > 0 ? (
          <View style={{ gap: tokens.spacing.xs }}>
            <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
              {t('milk.filterTank')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
              <Chip
                label={t('milk.allTanks')}
                selected={draftTankId === null}
                onPress={() => setDraftTankId(null)}
                testID="filter-tank-all"
              />
              {tanks.map((tank) => (
                <Chip
                  key={tank.id}
                  label={tank.name}
                  selected={draftTankId === tank.id}
                  onPress={() => setDraftTankId(tank.id)}
                  testID={`filter-tank-${tank.id}`}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer Actions */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: tokens.spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: tokens.spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            label={t('milk.resetFilter')}
            variant="secondary"
            size="md"
            onPress={handleReset}
            testID="filter-reset-btn"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            label={t('milk.applyFilter')}
            variant="primary"
            size="md"
            onPress={handleApply}
            testID="filter-apply-btn"
          />
        </View>
      </View>
    </SheetModal>
  );
}
