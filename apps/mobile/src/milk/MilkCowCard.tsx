/**
 * Ergonomic Cow Milking Entry Card (WP10 UI/UX overhaul).
 *
 * Replaces bulky steppers with a high-efficiency direct numeric input + quick increment chips (+0.5, +1.0, +5.0).
 * Displays yesterday's reference yield and 7-day average.
 * When a cow is under medication withholding (`withholding === true`), input is strictly blocked,
 * displays a prominent Withheld badge, and indicates routing to the Withholding Tank.
 *
 * Compliant with ADR-007 (zero drop shadows, 1px border and token fills only).
 */
import { memo, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
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
  const { colors, tokens } = useTheme();
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

  // Local text input state for fluid typing
  const [textVal, setTextVal] = useState(() => (row.yieldL !== null ? String(row.yieldL) : ''));

  useEffect(() => {
    setTextVal(row.yieldL !== null ? String(row.yieldL) : '');
  }, [row.yieldL]);

  const handleTextChange = (text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    setTextVal(formatted);

    if (formatted === '' || formatted === '.') {
      onChangeYield(row.cattleId, null);
    } else {
      const parsed = parseFloat(formatted);
      if (!Number.isNaN(parsed)) {
        onChangeYield(row.cattleId, parsed);
      }
    }
  };

  const handleStep = (delta: number) => {
    if (isInputDisabled) return;
    const cur = row.yieldL ?? 0;
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    onChangeYield(row.cattleId, next === 0 && delta < 0 ? null : next);
  };

  return (
    <View
      testID={testID ?? `milk-cow-card-${row.cattleId}`}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        gap: tokens.spacing.sm,
      }}
    >
      {/* Header: Title, Subtitle, Status Badges */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: tokens.spacing.sm,
        }}
      >
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

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs, justifyContent: 'flex-end' }}>
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

      {/* Reference Yields & Withholding Notice */}
      {row.withholding ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            paddingVertical: tokens.spacing.xs,
          }}
        >
          <Glyph name="exclamation" size={16} color="destructive" />
          <Text role="caption" color="destructive" style={{ fontWeight: '500' }}>
            {row.withholdingReason || t('milk.withholdingReason')}
          </Text>
          <Text role="caption" color="destructive">
            · {t('milk.withheldRoutingNote')}
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: tokens.spacing.md }}>
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

      {/* Ergonomic Milking Yield Controls */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          marginTop: tokens.spacing.xs,
        }}
      >
        {/* Direct Numeric Input Box */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            height: tokens.touchTarget.min,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: isInputDisabled ? colors.border : colors.inputBorder,
            backgroundColor: isInputDisabled ? colors.muted : colors.card,
            paddingHorizontal: tokens.spacing.sm,
          }}
        >
          <TextInput
            testID={`milk-stepper-${row.cattleId}-input`}
            value={textVal}
            onChangeText={handleTextChange}
            editable={!isInputDisabled}
            keyboardType="decimal-pad"
            returnKeyType="done"
            placeholder={row.prevDayYieldL !== undefined ? String(row.prevDayYieldL) : '0.0'}
            placeholderTextColor={colors.mutedForeground}
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: '600',
              color: isInputDisabled ? colors.mutedForeground : colors.foreground,
              paddingVertical: 0,
            }}
          />
          <Text role="caption" color="mutedForeground" style={{ fontWeight: '600', marginLeft: tokens.spacing.xs }}>
            {t('milk.unit')}
          </Text>
        </View>

        {/* Quick Increment Chips */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          {/* Minus 0.5 */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel="Decrease 0.5 L"
            accessibilityState={{ disabled: isInputDisabled }}
            disabled={isInputDisabled}
            pressedStyle="overlay"
            onPress={() => handleStep(-0.5)}
            testID={`milk-stepper-${row.cattleId}-minus`}
            style={{
              minWidth: tokens.touchTarget.min,
              minHeight: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.xs,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isInputDisabled ? 0.4 : 1,
            }}
          >
            <Glyph name="minus" size={16} color="foreground" />
          </PressableSurface>

          {/* Plus 0.5 (meets testID milk-stepper-*-plus) */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('milk.quickAdd', { amount: '0.5' })}
            accessibilityState={{ disabled: isInputDisabled }}
            disabled={isInputDisabled}
            pressedStyle="overlay"
            onPress={() => handleStep(0.5)}
            testID={`milk-stepper-${row.cattleId}-plus`}
            style={{
              minWidth: tokens.touchTarget.min,
              minHeight: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.xs,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isInputDisabled ? 0.4 : 1,
            }}
          >
            <Text role="caption" color="foreground" style={{ fontWeight: '600' }}>
              +0.5
            </Text>
          </PressableSurface>

          {/* Plus 1.0 */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('milk.quickAdd', { amount: '1.0' })}
            accessibilityState={{ disabled: isInputDisabled }}
            disabled={isInputDisabled}
            pressedStyle="overlay"
            onPress={() => handleStep(1.0)}
            testID={`milk-chip-plus-1-${row.cattleId}`}
            style={{
              minWidth: tokens.touchTarget.min,
              minHeight: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.xs,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isInputDisabled ? 0.4 : 1,
            }}
          >
            <Text role="caption" color="foreground" style={{ fontWeight: '600' }}>
              +1.0
            </Text>
          </PressableSurface>

          {/* Plus 5.0 */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={t('milk.quickAdd', { amount: '5.0' })}
            accessibilityState={{ disabled: isInputDisabled }}
            disabled={isInputDisabled}
            pressedStyle="overlay"
            onPress={() => handleStep(5.0)}
            testID={`milk-chip-plus-5-${row.cattleId}`}
            style={{
              minWidth: tokens.touchTarget.min,
              minHeight: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.xs,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isInputDisabled ? 0.4 : 1,
            }}
          >
            <Text role="caption" color="foreground" style={{ fontWeight: '600' }}>
              +5.0
            </Text>
          </PressableSurface>
        </View>
      </View>
    </View>
  );
});
