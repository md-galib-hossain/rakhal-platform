/**
 * Cow milk entry card (WP10, ADR-006).
 *
 * Displays cow identity, status indicators (saved / waiting / failed / conflict), anomaly flag,
 * ghost yield values (yesterday's yield and 7d average), and a StepperField for litres.
 *
 * When a cow is under medication withholding (`withholding === true`), milk logging is strictly
 * blocked: input is disabled and the card displays a withholding warning badge.
 */
import { memo } from 'react';
import { View } from 'react-native';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { StepperField } from '../components/forms/StepperField.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { radius, spacing } from '../theme/tokens.ts';
import { categoryKey, cattleTitle } from '../cattle/cattle-model.ts';
import { isMilkAnomaly, type MilkCowRow } from './milk-model.ts';

export interface MilkCowCardProps {
  row: MilkCowRow;
  disabled?: boolean;
  onChangeYield: (cattleId: string, yieldL: number | null) => void;
  testID?: string;
}

export const MilkCowCard = memo(function MilkCowCard({
  row,
  disabled = false,
  onChangeYield,
  testID,
}: MilkCowCardProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const title = cattleTitle({ tagNumber: row.tag, name: row.name });
  const category = categoryKey(row.animalCategory);
  const subtitleParts = [
    category ? t(category) : row.animalCategory,
    row.breedName,
    row.shedName,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' · ');

  const hasAnomaly = isMilkAnomaly(row.yieldL, row.avgYield7d, row.anomalyFlag);
  const isInputDisabled = disabled || row.withholding || row.isSubmitted;

  return (
    <View
      testID={testID ?? `milk-cow-card-${row.cattleId}`}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      {/* Header: Title, Subtitle, Badges */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text role="title" color="foreground">
            {title || '—'}
          </Text>
          {subtitle ? (
            <Text role="caption" color="mutedForeground">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'flex-end' }}>
          {row.withholding ? (
            <StatusBadge
              tone="destructive"
              label={t('milk.withholdingBadge')}
              testID={`milk-withholding-${row.cattleId}`}
            />
          ) : null}

          {hasAnomaly ? (
            <StatusBadge
              tone="warning"
              label={t('milk.anomalyBadge')}
              testID={`milk-anomaly-${row.cattleId}`}
            />
          ) : null}

          {row.status === 'saved' ? (
            <StatusBadge
              tone="success"
              label={t('milk.status.saved')}
              testID={`milk-status-${row.cattleId}`}
            />
          ) : row.status === 'waiting' ? (
            <StatusBadge
              tone="warning"
              label={t('milk.status.waiting')}
              testID={`milk-status-${row.cattleId}`}
            />
          ) : row.status === 'failed' ? (
            <StatusBadge
              tone="destructive"
              label={t('milk.status.failed')}
              testID={`milk-status-${row.cattleId}`}
            />
          ) : row.status === 'conflict' ? (
            <StatusBadge
              tone="destructive"
              label={t('milk.status.conflict')}
              testID={`milk-status-${row.cattleId}`}
            />
          ) : null}
        </View>
      </View>

      {/* Ghost values / Withholding notice */}
      {row.withholding ? (
        <Text role="caption" color="destructive">
          {row.withholdingReason || t('milk.withholdingReason')}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {row.prevDayYieldL !== undefined ? (
            <Text role="caption" color="mutedForeground">
              {t('milk.prevDay', { yield: format.numberSafe(row.prevDayYieldL, { fractionDigits: 1 }) })}
            </Text>
          ) : null}
          {row.avgYield7d !== undefined ? (
            <Text role="caption" color="mutedForeground">
              {t('milk.avg7d', { yield: format.numberSafe(row.avgYield7d, { fractionDigits: 1 }) })}
            </Text>
          ) : null}
        </View>
      )}

      {/* Stepper Field */}
      <StepperField
        label={t('milk.yield')}
        value={row.yieldL}
        onChange={(val) => onChangeYield(row.cattleId, val)}
        step={0.5}
        min={0}
        max={100}
        unit={t('milk.unit')}
        placeholderValue={row.prevDayYieldL}
        disabled={isInputDisabled}
        testID={`milk-stepper-${row.cattleId}`}
      />
    </View>
  );
});
