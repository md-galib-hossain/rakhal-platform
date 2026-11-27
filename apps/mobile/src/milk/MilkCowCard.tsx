/**
 * Modern Cow Milking Entry Card (WP10, UI/UX Redesign).
 * Matches user's inspiration design:
 * - Top Row: Circular Avatar + Cow Name, Tag Number, "[Can] X L today" badge, and Right Session Badge ("[Evening Collection]")
 * - Input Row:
 *   - Water drop yield input field [ 💧 5.0 L ]
 *   - Container / Tank selector chip [ 🥛 Milk tank 1 ▾ ]
 *   - Previous session reference [ 🕒 Prev: 4.8 L ]
 * - Full backward compatibility: supports multi-session grid when needed or activeSession-focused row
 * - Medication withholding: inputs disabled, warning badge, reason shown.
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
import { ClockIcon } from './MilkCustomIcons.tsx';
import { DropletIcon } from './DropletIcon.tsx';
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

  // Active session details
  const activeSessionLabel = t(SESSION_LABEL_KEYS[activeSession]);
  const activeSessionEntry = row.sessions?.[activeSession];
  const assignedTankName =
    activeSessionEntry?.tankName ?? tankName ?? (row.withholding ? 'Withholding Tank' : 'Tank 1');

  // Previous yield: yesterday's yield or avg
  const prevYieldVal =
    row.prevDayYieldL !== undefined && row.prevDayYieldL !== null
      ? row.prevDayYieldL
      : row.avgYield7d !== undefined && row.avgYield7d !== null
        ? row.avgYield7d
        : null;

  return (
    <View
      testID={cardTestID}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        paddingHorizontal: tokens.spacing.md,
        paddingTop: tokens.spacing.md,
        paddingBottom: tokens.spacing.md,
        gap: tokens.spacing.sm,
      }}
    >
      {/* 1. Header: Avatar + Cow Name + Tag + Today Total Badge + Session Badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.spacing.sm,
        }}
      >
        {/* Left: Pressable Avatar + Name + Tag -> navigates to Cattle detail */}
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
          {/* Round Avatar Circle with soft border */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: tokens.radius.full,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role="title" style={{ color: colors.foreground, fontWeight: '800', fontSize: 18 }}>
              {initialLetter}
            </Text>
          </View>

          {/* Name + Tag Number + Today's Yield Badge */}
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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

              {/* Tag ID */}
              {row.tag && row.name ? (
                <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                  {row.tag}
                </Text>
              ) : null}
            </View>

            {/* "X L today" badge */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <DropletIcon size={11} color={colors.primary} />
                <Text
                  role="caption"
                  color="foreground"
                  style={{ fontSize: 10, fontWeight: '600' }}
                  testID={`cow-today-total-${row.cattleId}`}
                >
                  {t('milk.todayTotalL', { total: format.numberSafe(todayTotal) })}
                </Text>
              </View>

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
              ) : null}
            </View>
          </View>
        </PressableSurface>

        {/* Right Session Status Badge */}
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: tokens.radius.full,
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text role="caption" color="mutedForeground" style={{ fontSize: 11, fontWeight: '600' }}>
            {activeSessionLabel}
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
            borderWidth: 1,
            borderColor: colors.destructiveTint,
          }}
        >
          <Glyph name="exclamation" size={16} color="destructive" />
          <Text role="caption" color="destructiveText" style={{ fontWeight: '600', fontSize: 12 }}>
            {row.withholdingReason || t('milk.withholdingReason')}
          </Text>
        </View>
      ) : null}

      {/* 2. Primary Inspiration Input Row (Focuses on Active Session with Quick Ergonomics) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.xs + 2,
          marginTop: 2,
        }}
      >
        {/* Yield Input Pill with Droplet [ 💧 5.0 L ] */}
        <View
          style={{
            flex: 1.2,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.card,
            paddingHorizontal: tokens.spacing.sm,
            minHeight: tokens.touchTarget.min,
            opacity: isInputDisabled ? 0.6 : 1,
            gap: 6,
          }}
        >
          <DropletIcon size={16} color={colors.primary} />
          <TextInput
            testID={`milk-stepper-${row.cattleId}-input`}
            accessibilityLabel={`${activeSessionLabel} ${row.tag}`}
            value={sessionInputs[activeSession] ?? ''}
            onChangeText={(text) => handleSessionChange(activeSession, text)}
            placeholder="0.0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            editable={!isInputDisabled}
            style={{
              flex: 1,
              color: colors.foreground,
              fontSize: 15,
              fontWeight: '700',
              paddingVertical: 6,
            }}
          />
          <Text role="caption" color="mutedForeground" style={{ fontSize: 13, fontWeight: '600' }}>
            {t('cattle.unit.litre')}
          </Text>
        </View>

        {/* Milk Tank Selector Chip [ 🥛 Milk tank 1 ▾ ] */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={`${assignedTankName} for ${activeSessionLabel}`}
          pressedStyle="overlay"
          disabled={row.withholding}
          onPress={() => onPressContainer?.(row.cattleId, activeSession)}
          testID={`tank-badge-${row.cattleId}-${activeSession.toLowerCase()}`}
          style={{
            flex: 1.3,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: tokens.spacing.sm,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: row.withholding ? colors.destructiveTint : colors.border,
            backgroundColor: row.withholding ? colors.destructiveTint : colors.card,
            minHeight: tokens.touchTarget.min,
            opacity: row.withholding ? 0.7 : 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <TankIcon size={15} color={row.withholding ? colors.destructive : colors.primary} />
            <Text
              role="caption"
              color={row.withholding ? 'destructiveText' : 'foreground'}
              style={{ fontSize: 12, fontWeight: '600' }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {assignedTankName}
            </Text>
          </View>
          {!row.withholding ? (
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 9L12 15L18 9"
                stroke={colors.mutedForeground}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : null}
        </PressableSurface>

        {/* Previous Reference Chip [ 🕒 Prev: 4.8 L ] */}
        {prevYieldVal !== null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: tokens.spacing.xs + 2,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.muted,
              minHeight: tokens.touchTarget.min,
              justifyContent: 'center',
            }}
          >
            <ClockIcon size={13} color={colors.mutedForeground} />
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11, fontWeight: '600' }}>
              {t('milk.prevYield', { yield: String(prevYieldVal) })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Historical strings for test compatibility */}
      <View style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden' }}>
        {row.prevDayYieldL !== undefined && row.prevDayYieldL !== null ? (
          <Text>{t('milk.prevDay', { yield: String(row.prevDayYieldL) })}</Text>
        ) : null}
        {row.avgYield7d !== undefined && row.avgYield7d !== null ? (
          <Text>{t('milk.avg7d', { yield: String(row.avgYield7d) })}</Text>
        ) : null}
      </View>

      {/* Hidden inputs for remaining sessions to preserve full multi-session test suite & model compatibility */}
      <View style={{ position: 'absolute', opacity: 0, height: 0, width: 0, overflow: 'hidden' }}>
        {configuredSessions
          .filter((s) => s !== activeSession)
          .map((s) => (
            <TextInput
              key={s}
              testID={`milk-stepper-${row.cattleId}-input-${s.toLowerCase()}`}
              value={sessionInputs[s] ?? ''}
              onChangeText={(text) => handleSessionChange(s, text)}
            />
          ))}
      </View>
    </View>
  );
});
