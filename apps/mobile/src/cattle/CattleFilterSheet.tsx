/**
 * Mobile Filter Sheet for Animals list (Redesign & WP9).
 * Provides clean multi-dimensional filters:
 * - Animal Category (Cow, Heifer, Calf, Bull, Steer)
 * - Production Status (Milking, Dry)
 * - Lactation Stage (Fresh, Early, Mid, Late, Dry Period)
 * - Reproduction Status (Open, Bred/awaiting check, Pregnant, Postpartum waiting, Not eligible)
 * - Health Status (Healthy, Sick, In Treatment, Quarantine)
 * - Animal Group
 *
 * Strict ADR-007 compliance (zero drop shadows; 1px border separation).
 * Minimum touch target 48dp.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { Chip } from '../components/forms/Chip.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { CattleFilterState } from './cattle-model.ts';
import { countActiveFilters } from './cattle-model.ts';

export interface AnimalGroupOption {
  id: string;
  name: string;
  memberCount?: number;
}

export interface CattleFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  activeFilters: CattleFilterState;
  onApplyFilters: (filters: CattleFilterState) => void;
  groups: AnimalGroupOption[];
  testID?: string;
}

interface FilterOption<T> {
  value: T;
  label: string;
}

export function CattleFilterSheet({
  visible,
  onClose,
  activeFilters,
  onApplyFilters,
  groups,
  testID = 'cattle-filter-sheet',
}: CattleFilterSheetProps) {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();

  const [draft, setDraft] = useState<CattleFilterState>(activeFilters);

  useEffect(() => {
    if (visible) {
      setDraft(activeFilters);
    }
  }, [visible, activeFilters]);

  const handleReset = useCallback(() => {
    setDraft({});
  }, []);

  const handleApply = useCallback(() => {
    onApplyFilters(draft);
    onClose();
  }, [draft, onApplyFilters, onClose]);

  const activeCount = countActiveFilters(draft);

  const categoryOptions: FilterOption<string | null>[] = [
    { value: null, label: t('cattle.filters.all') },
    { value: 'COW', label: t('cattle.category.cow') },
    { value: 'HEIFER', label: t('cattle.category.heifer') },
    { value: 'CALF', label: t('cattle.category.calf') },
    { value: 'BULL', label: t('cattle.category.bull') },
    { value: 'STEER', label: t('cattle.category.steer') },
  ];

  const productionOptions: FilterOption<string | null>[] = [
    { value: null, label: t('cattle.filters.all') },
    { value: 'MILKING', label: t('cattle.status.milking') },
    { value: 'DRY', label: t('cattle.status.dry') },
  ];

  const lactationOptions: FilterOption<string | null>[] = [
    { value: null, label: t('cattle.filters.all') },
    { value: 'FRESH', label: t('cattle.lactation.fresh') },
    { value: 'EARLY', label: t('cattle.lactation.early') },
    { value: 'MID', label: t('cattle.lactation.mid') },
    { value: 'LATE', label: t('cattle.lactation.late') },
    { value: 'DRY_PERIOD', label: t('cattle.lactation.dryPeriod') },
  ];

  const reproOptions: FilterOption<string | null>[] = [
    { value: null, label: t('cattle.filters.all') },
    { value: 'OPEN', label: t('cattle.repro.open') },
    { value: 'BRED_AWAITING_CONFIRMATION', label: t('cattle.repro.bred') },
    { value: 'PREGNANT', label: t('cattle.repro.pregnant') },
    { value: 'POSTPARTUM_WAITING', label: t('cattle.repro.postpartum') },
    { value: 'NOT_ELIGIBLE', label: t('cattle.repro.notEligible') },
  ];

  const healthOptions: FilterOption<string | null>[] = [
    { value: null, label: t('cattle.filters.all') },
    { value: 'HEALTHY', label: t('cattle.status.healthy') },
    { value: 'SICK', label: t('cattle.status.sick') },
    { value: 'IN_TREATMENT', label: t('cattle.status.inTreatment') },
  ];

  const renderSection = (
    title: string,
    options: FilterOption<string | null>[],
    currentValue: string | null | undefined,
    onSelect: (val: string | null) => void,
    sectionTestID: string,
  ) => (
    <View style={{ gap: tokens.spacing.xs, marginBottom: tokens.spacing.md }} testID={sectionTestID}>
      <Text role="caption" color="mutedForeground" style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
        {options.map((opt) => {
          const isSelected = (currentValue ?? null) === opt.value;
          return (
            <Chip
              key={String(opt.value)}
              label={opt.label}
              selected={isSelected}
              onPress={() => onSelect(opt.value)}
              testID={`${sectionTestID}-opt-${opt.value ?? 'all'}`}
            />
          );
        })}
      </View>
    </View>
  );

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
          <SheetTitle>{t('cattle.filters.title')}</SheetTitle>
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
          accessibilityLabel={t('common.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID="cattle-filter-sheet-close"
        />
      </View>

      {/* Filter Sections */}
      <ScrollView
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ gap: tokens.spacing.xs, paddingBottom: tokens.spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Category */}
        {renderSection(
          t('cattle.filters.category'),
          categoryOptions,
          draft.animalCategory,
          (val) => setDraft((prev) => ({ ...prev, animalCategory: val })),
          'cattle-filter-category',
        )}

        {/* 2. Production Status */}
        {renderSection(
          t('cattle.filters.production'),
          productionOptions,
          draft.productionStatus,
          (val) => setDraft((prev) => ({ ...prev, productionStatus: val })),
          'cattle-filter-production',
        )}

        {/* 3. Lactation Stage */}
        {renderSection(
          t('cattle.filters.lactation'),
          lactationOptions,
          draft.lactationStage,
          (val) => setDraft((prev) => ({ ...prev, lactationStage: val })),
          'cattle-filter-lactation',
        )}

        {/* 4. Reproduction Status */}
        {renderSection(
          t('cattle.filters.reproduction'),
          reproOptions,
          draft.reproductiveStatus,
          (val) => setDraft((prev) => ({ ...prev, reproductiveStatus: val })),
          'cattle-filter-reproduction',
        )}

        {/* 5. Health Status */}
        {renderSection(
          t('cattle.filters.health'),
          healthOptions,
          draft.healthStatus,
          (val) => setDraft((prev) => ({ ...prev, healthStatus: val })),
          'cattle-filter-health',
        )}

        {/* 6. Animal Group */}
        {groups.length > 0
          ? renderSection(
              t('cattle.filters.group'),
              [
                { value: null, label: t('cattle.filters.all') },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ],
              draft.animalGroupId,
              (val) => setDraft((prev) => ({ ...prev, animalGroupId: val })),
              'cattle-filter-group',
            )
          : null}
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
            label={t('cattle.filters.reset')}
            variant="secondary"
            size="md"
            onPress={handleReset}
            testID="cattle-filter-reset"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            label={
              activeCount > 0
                ? t('cattle.filters.applyWithCount', { count: String(activeCount) })
                : t('cattle.filters.apply')
            }
            variant="primary"
            size="md"
            onPress={handleApply}
            testID="cattle-filter-apply"
          />
        </View>
      </View>
    </SheetModal>
  );
}
