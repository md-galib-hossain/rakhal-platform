/**
 * Modern Cow Milking Entry Card (WP10, UI/UX overhaul).
 *
 * Streamlined design per user direction:
 * - Direct numeric input field with decimal keyboard.
 * - Removed + / - steppers and quick-increment chips.
 * - No "! Waiting" badges to eliminate visual clutter.
 * - Top row: Cow Tag/Name (bold) + Shed name + Status badge (Milking / Withheld).
 * - Middle/Bottom row:
 *   - Reference yields (Yesterday & 7d avg).
 *   - Destination Tank badge (Main Tank or Withholding Tank).
 *   - Prominent numeric yield input box with decimal keyboard.
 * - When under medication withholding: input disabled, warning notice, Withholding Tank routed.
 * - ADR-007 compliant: strictly zero drop shadows, 1px border and token fills only.
 */
import { memo, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { cattleTitle } from '../cattle/cattle-model.ts';
import { isMilkAnomaly, type MilkCowRow } from './milk-model.ts';

export interface MilkCowCardProps {
  row: MilkCowRow;
  disabled?: boolean;
  tankName?: string;
  onChangeYield: (cattleId: string, yieldL: number | null) => void;
  testID?: string;
}

export const MilkCowCard = memo(function MilkCowCard({
  row,
  disabled = false,
  tankName,
  onChangeYield,
  testID,
}: MilkCowCardProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const title = cattleTitle({ tagNumber: row.tag, name: row.name });
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

  const cardTestID = testID ?? `milk-cow-card-${row.cattleId}`;

  return (
    <View
      testID={cardTestID}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        gap: tokens.spacing.sm,
      }}
    >
      {/* Top Row: Cow Tag/Name + Shed Name + Status Badge */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: tokens.spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text role="title" color="foreground" style={{ fontWeight: '700' }}>
            {title || '—'}
          </Text>
          {row.shedName ? (
            <Text role="caption" color="mutedForeground">
              {row.shedName}
            </Text>
          ) : null}
        </View>

        {/* Right Status Badges (Milking / Withheld / Anomaly / Error) - NO "Waiting" badge */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.xs, justifyContent: 'flex-end' }}>
          {row.withholding ? (
            <StatusBadge
              tone="destructive"
              label={t('milk.withholdingBadge')}
              testID={`milk-withholding-${row.cattleId}`}
            />
          ) : (
            <StatusBadge
              tone="info"
              label={t('cattle.status.milking')}
              testID={`milk-status-milking-${row.cattleId}`}
            />
          )}

          {hasAnomaly ? (
            <StatusBadge
              tone="warning"
              label={t('milk.anomalyBadge')}
              testID={`milk-anomaly-${row.cattleId}`}
            />
          ) : null}

          {row.status === 'failed' ? (
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

      {/* Withholding Alert Banner */}
      {row.withholding ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            paddingVertical: 2,
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
      ) : null}

      {/* Middle/Bottom Row: Reference Yields & Tank Badge on Left, Numeric Input on Right */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm,
          paddingTop: tokens.spacing.xs,
        }}
      >
        {/* Left Column: Reference Yields & Tank Routing Badge */}
        <View style={{ flex: 1, gap: 4 }}>
          {/* Reference Yields */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.xs }}>
            {row.prevDayYieldL !== undefined ? (
              <Text role="caption" color="mutedForeground">
                {t('milk.prevDay', { yield: format.numberSafe(row.prevDayYieldL, { fractionDigits: 1 }) })}
              </Text>
            ) : null}
            {row.prevDayYieldL !== undefined && row.avgYield7d !== undefined ? (
              <Text role="caption" color="mutedForeground">
                ·
              </Text>
            ) : null}
            {row.avgYield7d !== undefined ? (
              <Text role="caption" color="mutedForeground">
                {t('milk.avg7d', { yield: format.numberSafe(row.avgYield7d, { fractionDigits: 1 }) })}
              </Text>
            ) : null}
          </View>

          {/* Destination Tank Badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              testID={`milk-tank-badge-${row.cattleId}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: tokens.radius.full,
                borderWidth: 1,
                borderColor: row.withholding ? colors.destructive : colors.border,
                backgroundColor: row.withholding ? colors.muted : colors.card,
              }}
            >
              <Glyph name="dot" size={16} color={row.withholding ? 'destructive' : 'primary'} />
              <Text
                role="caption"
                color={row.withholding ? 'destructive' : 'mutedForeground'}
                style={{ fontSize: 11, fontWeight: '500' }}
              >
                {row.withholding ? t('milk.tankWithholding') : (tankName || t('milk.tankSellable'))}
              </Text>
            </View>
          </View>
        </View>

        {/* Right: Clean, Prominent Numeric Input Field */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: tokens.touchTarget.min,
            minWidth: 104,
            maxWidth: 130,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: isInputDisabled ? colors.border : colors.inputBorder,
            backgroundColor: isInputDisabled ? colors.muted : colors.background,
            paddingHorizontal: tokens.spacing.sm,
            gap: 4,
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
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'right',
              color: isInputDisabled ? colors.mutedForeground : colors.foreground,
              paddingVertical: 0,
            }}
          />
          <Text role="caption" color="mutedForeground" style={{ fontWeight: '600' }}>
            {t('milk.unit')}
          </Text>
        </View>
      </View>
    </View>
  );
});
