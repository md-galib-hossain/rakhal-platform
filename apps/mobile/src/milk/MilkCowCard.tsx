/**
 * Modern Cow Milking Entry Card (WP10, UI/UX Redesign).
 * Matches user's reference mockup:
 * - Left: Circular initial avatar in primary tint, e.g. 'B' for Bella, 'P' for Padma.
 * - Middle: Cow Name, Status Badge (Milking / Withheld), Tag Number · Breed / Shed.
 * - Right: Today's Total in bold teal + 'Today's total' subtitle.
 * - Body: Multi-session grid (AM1, AM2, PM1, PM2 / configured sessions):
 *   - Session label
 *   - Numeric decimal input field
 *   - Container chip button [ 🟦 Tank A 📦 ] opening container selection sheet
 * - When medication-withheld: inputs disabled, Withholding Tank routed, warning reason shown.
 * - ADR-007 compliant: strictly zero drop shadows, 1px border and token fills only.
 */
import { memo, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { cattleTitle } from '../cattle/cattle-model.ts';
import { TankIcon } from './TankIcon.tsx';
import {
  DEFAULT_SESSIONS,
  SESSION_LABEL_KEYS,
  type MilkCowRow,
  type MilkSession,
} from './milk-model.ts';

export interface MilkCowCardProps {
  row: MilkCowRow;
  disabled?: boolean;
  activeSession?: MilkSession;
  configuredSessions?: readonly MilkSession[];
  tankName?: string;
  onChangeYield: (
    cattleId: string,
    sessionOrYield: MilkSession | number | null,
    maybeYield?: number | null,
  ) => void;
  onPressContainer?: (cattleId: string, session: MilkSession) => void;
  testID?: string;
}

export const MilkCowCard = memo(function MilkCowCard({
  row,
  disabled = false,
  activeSession = 'MORNING',
  configuredSessions = DEFAULT_SESSIONS,
  tankName,
  onChangeYield,
  onPressContainer,
  testID,
}: MilkCowCardProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const title = cattleTitle({ tagNumber: row.tag, name: row.name });
  const isInputDisabled = disabled || row.withholding;
  const initialLetter = (row.name?.trim() || row.tag || 'C').charAt(0).toUpperCase();

  const subtitleParts: string[] = [];
  if (row.name?.trim() && row.tag) {
    subtitleParts.push(row.tag);
  }
  if (row.breedName) {
    subtitleParts.push(row.breedName);
  } else if (row.shedName) {
    subtitleParts.push(row.shedName);
  }
  const subtitleText = subtitleParts.join(' · ');

  // Local state for each session's text input to allow fluid decimal typing
  const [sessionInputs, setSessionInputs] = useState<Record<MilkSession, string>>(() => {
    const init: Record<MilkSession, string> = {
      MORNING: '',
      NOON: '',
      EVENING: '',
      NIGHT: '',
    };
    for (const s of DEFAULT_SESSIONS) {
      const val = row.sessions?.[s]?.yieldL ?? (s === activeSession ? row.yieldL : null);
      init[s] = val !== null && val !== undefined ? String(val) : '';
    }
    return init;
  });

  // Sync when row values update from outside
  useEffect(() => {
    setSessionInputs((prev) => {
      const updated = { ...prev };
      for (const s of DEFAULT_SESSIONS) {
        const val = row.sessions?.[s]?.yieldL ?? (s === activeSession ? row.yieldL : null);
        const strVal = val !== null && val !== undefined ? String(val) : '';
        if (parseFloat(prev[s] || '0') !== parseFloat(strVal || '0')) {
          updated[s] = strVal;
        }
      }
      return updated;
    });
  }, [row.sessions, row.yieldL, activeSession]);

  const handleSessionChange = (targetSession: MilkSession, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;

    setSessionInputs((prev) => ({ ...prev, [targetSession]: formatted }));

    if (formatted === '' || formatted === '.') {
      onChangeYield(row.cattleId, targetSession, null);
    } else {
      const parsed = parseFloat(formatted);
      if (!Number.isNaN(parsed)) {
        onChangeYield(row.cattleId, targetSession, parsed);
      }
    }
  };

  const cardTestID = testID ?? `milk-cow-card-${row.cattleId}`;

  // Today's total for this cow
  const todayTotal = row.todayTotalL ?? (row.yieldL ?? 0);

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
      {/* Header: Avatar + Cow Info + Today's Total */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm,
        }}
      >
        {/* Left & Middle: Pressable Avatar + Name + Tag -> navigates to Cattle detail */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={`${title} ${t('cattle.detail.title')}`}
          pressedStyle="overlay"
          onPress={() => router.push(`/cattle/${encodeURIComponent(row.cattleId)}`)}
          testID={`milk-cow-nav-${row.cattleId}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.sm,
            flex: 1,
            minWidth: 0,
            borderRadius: tokens.radius.sm,
          }}
        >
          {/* Round Avatar Circle */}
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: tokens.radius.full,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role="title" style={{ color: colors.primaryForeground, fontWeight: '800', fontSize: 18 }}>
              {initialLetter}
            </Text>
          </View>

          {/* Name, Status Badge, Tag & Breed */}
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, flexWrap: 'wrap' }}>
              <Text
                role="label"
                color="foreground"
                style={{ fontWeight: '700', fontSize: 16 }}
                accessibilityLabel={title}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {row.name || row.tag || '—'}
              </Text>

              {row.withholding ? (
                <View
                  testID={`milk-withholding-${row.cattleId}`}
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                    borderRadius: tokens.radius.full,
                    backgroundColor: colors.destructiveTint,
                  }}
                >
                  <Text role="caption" color="destructiveText" style={{ fontSize: 10, fontWeight: '600' }}>
                    {t('milk.withholdingBadge')}
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1.5,
                    borderRadius: tokens.radius.full,
                    backgroundColor: colors.successTint,
                  }}
                >
                  <Text role="caption" color="primaryText" style={{ fontSize: 10, fontWeight: '600' }}>
                    {t('milk.statusMilking')}
                  </Text>
                </View>
              )}
            </View>

            {subtitleText ? (
              <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
                {subtitleText}
              </Text>
            ) : null}
          </View>
        </PressableSurface>

        {/* Right: Today's Total */}
        <View style={{ alignItems: 'flex-end', gap: 1 }}>
          <Text
            role="title"
            color="primary"
            style={{ fontWeight: '800', fontSize: 18 }}
            testID={`cow-today-total-${row.cattleId}`}
          >
            {format.numberSafe(todayTotal)}L
          </Text>
          <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
            {t('milk.todayTotal')}
          </Text>
        </View>
      </View>

      {/* Medication Withholding Notice */}
      {row.withholding ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            padding: tokens.spacing.xs + 2,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.muted,
          }}
        >
          <Glyph name="exclamation" size={16} color="destructive" />
          <Text role="caption" color="destructiveText" style={{ fontWeight: '600', fontSize: 12 }}>
            {row.withholdingReason || t('milk.withholdingReason')}
          </Text>
        </View>
      ) : null}

      {/* Reference Historical Yields (Yesterday & 7d avg) */}
      {(row.prevDayYieldL !== undefined && row.prevDayYieldL !== null) ||
      (row.avgYield7d !== undefined && row.avgYield7d !== null) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          {row.prevDayYieldL !== undefined && row.prevDayYieldL !== null ? (
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
              {t('milk.prevDay', { yield: String(row.prevDayYieldL) })}
            </Text>
          ) : null}
          {row.avgYield7d !== undefined && row.avgYield7d !== null ? (
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
              {t('milk.avg7d', { yield: String(row.avgYield7d) })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Session Matrix Grid (AM1, AM2, PM1, PM2 or configured sessions) */}
      <View
        style={{
          flexDirection: 'row',
          gap: tokens.spacing.xs,
          marginTop: tokens.spacing.xs,
        }}
      >
        {configuredSessions.map((s) => {
          const sLabel = t(SESSION_LABEL_KEYS[s]);
          const isSelectedSession = s === activeSession;
          const sEntry = row.sessions?.[s];
          const assignedTankName = sEntry?.tankName ?? tankName ?? (row.withholding ? 'Withholding Tank' : 'Tank A');
          const isCellDisabled = isInputDisabled;
          const textVal = sessionInputs[s] ?? '';

          // Primary testID for the active session to satisfy existing tests
          const inputTestID = isSelectedSession
            ? `milk-stepper-${row.cattleId}-input`
            : `milk-stepper-${row.cattleId}-input-${s.toLowerCase()}`;

          return (
            <View key={s} style={{ flex: 1, gap: 4 }}>
              {/* Session Column Label (AM1, AM2, etc.) */}
              <Text
                role="caption"
                color={isSelectedSession ? 'primary' : 'mutedForeground'}
                style={{
                  textAlign: 'center',
                  fontWeight: isSelectedSession ? '700' : '600',
                  fontSize: 11,
                }}
              >
                {sLabel}
              </Text>

              {/* Decimal Yield Input Field */}
              <View
                style={{
                  borderWidth: 1,
                  borderColor: isSelectedSession ? colors.primary : colors.border,
                  borderRadius: tokens.radius.md,
                  backgroundColor: colors.card,
                  minHeight: 38,
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                  opacity: isCellDisabled ? 0.6 : 1,
                }}
              >
                <TextInput
                  testID={inputTestID}
                  accessibilityLabel={`${sLabel} ${row.tag}`}
                  value={textVal}
                  onChangeText={(text) => handleSessionChange(s, text)}
                  placeholder="0.0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  editable={!isCellDisabled}
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: '700',
                    textAlign: 'center',
                    paddingVertical: 4,
                  }}
                />
              </View>

              {/* Tank Switcher Chip [ 🛢️ Tank A ▾ ] */}
              <PressableSurface
                accessibilityRole="button"
                accessibilityLabel={`${assignedTankName} for ${sLabel}`}
                pressedStyle="overlay"
                disabled={row.withholding}
                onPress={() => onPressContainer?.(row.cattleId, s)}
                testID={`tank-badge-${row.cattleId}-${s.toLowerCase()}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  paddingVertical: 2,
                  paddingHorizontal: 4,
                  borderRadius: tokens.radius.sm,
                  borderWidth: 1,
                  borderColor: row.withholding ? colors.destructiveTint : colors.border,
                  backgroundColor: row.withholding ? colors.destructiveTint : colors.card,
                  minHeight: 24,
                  opacity: row.withholding ? 0.7 : 1,
                }}
              >
                {/* Relevant Bulk Milk Tank Icon */}
                <TankIcon
                  size={12}
                  color={row.withholding ? colors.destructive : colors.primary}
                />
                <Text
                  role="caption"
                  color={row.withholding ? 'destructiveText' : 'foreground'}
                  style={{ fontSize: 10, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {assignedTankName}
                </Text>
                {!row.withholding ? (
                  <Svg width={7} height={7} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M6 9L12 15L18 9"
                      stroke={colors.mutedForeground}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                ) : null}
              </PressableSurface>
            </View>
          );
        })}
      </View>
    </View>
  );
});
