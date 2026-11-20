import { memo, useCallback, useState } from 'react';
import { LayoutAnimation, Platform, UIManager, View } from 'react-native';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { useReduceMotion } from '../components/internal/useReduceMotion.ts';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { avatarTint } from './avatar-tint.ts';
import {
  ageInMonths,
  categoryKey,
  cattleTitle,
  healthBadge,
  humanize,
  lactationBadge,
  primaryBadge,
  productionBadge,
  reproBadge,
  type CattleListItem,
} from './cattle-model.ts';
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  MapPinIcon,
  MarsIcon,
  ScaleIcon,
  VenusIcon,
} from './CattleIcons.tsx';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface CattleCardProps {
  item: CattleListItem;
  onSelect: (item: CattleListItem) => void;
  disabled?: boolean;
  testID?: string;
}

export const CattleCard = memo(function CattleCard({
  item,
  onSelect,
  disabled = false,
  testID,
}: CattleCardProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const reduceMotion = useReduceMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setIsExpanded((prev) => !prev);
  }, [reduceMotion]);

  const title = cattleTitle(item);
  const cardTestID = testID ?? `cattle-row-${item.id}`;
  const initial = (item.name?.trim() || item.tagNumber || 'C').charAt(0).toUpperCase();
  const tint = avatarTint(item.id, colors);

  // Age formatting
  const months = ageInMonths(item.dateOfBirth, Date.now());
  let ageText = '—';
  if (months !== null) {
    if (months >= 12) {
      const yrs = Math.floor(months / 12);
      const rem = months % 12;
      ageText = rem > 0
        ? `${format.numberSafe(yrs)}y ${format.numberSafe(rem)}m`
        : t('cattle.card.years', { count: format.numberSafe(yrs) });
    } else {
      ageText = t('cattle.card.months', { count: format.numberSafe(months) });
    }
  }

  // Weight formatting
  const weightText = item.lastWeightKg !== null
    ? t('cattle.card.weightKg', { weight: format.numberSafe(item.lastWeightKg) })
    : '—';

  // Shed formatting
  const shedText = item.shedName ?? '—';

  // Subtitle: category and breed (matches standard subtitle hierarchy)
  const categoryMsgKey = categoryKey(item.animalCategory);
  const categoryLabel = categoryMsgKey ? t(categoryMsgKey) : null;
  const subtitleText = item.breedName
    ? [categoryLabel, item.breedName].filter(Boolean).join(' · ')
    : null;

  // Next Event formatting
  let nextEventTitle: string | null = null;
  let nextEventDue: string | null = null;
  let nextEventUrgency = 'muted';

  if (item.nextEvent) {
    const ev = item.nextEvent;
    if (ev.kind === 'CALVING') {
      nextEventTitle = t('cattle.upcoming.calving');
    } else if (ev.kind === 'PREGNANCY_CHECK') {
      nextEventTitle = t('cattle.upcoming.pregnancyCheck');
    } else if (ev.kind === 'DRY_OFF') {
      nextEventTitle = t('cattle.upcoming.dryOff');
    } else if (ev.kind === 'HEALTH_STEP') {
      nextEventTitle = t('cattle.upcoming.healthStep');
    } else if (ev.kind === 'PREVENTIVE_STEP') {
      nextEventTitle = t('cattle.upcoming.preventiveStep');
    } else if (ev.kind === 'VACCINATION') {
      nextEventTitle = t('cattle.upcoming.vaccination');
    } else if (ev.kind === 'DEWORMING') {
      nextEventTitle = t('cattle.upcoming.deworming');
    } else {
      nextEventTitle = t('cattle.upcoming.task');
    }

    if (ev.daysUntil !== null && ev.daysUntil !== undefined) {
      if (ev.daysUntil < 0) {
        nextEventDue = t('cattle.upcoming.overdueDays', { count: format.numberSafe(-ev.daysUntil) });
        nextEventUrgency = 'destructive';
      } else if (ev.daysUntil === 0) {
        nextEventDue = t('cattle.upcoming.today');
        nextEventUrgency = 'warning';
      } else if (ev.daysUntil === 1) {
        nextEventDue = t('cattle.upcoming.tomorrow');
        nextEventUrgency = 'warning';
      } else {
        nextEventDue = t('cattle.upcoming.inDays', { count: format.numberSafe(ev.daysUntil) });
        nextEventUrgency = 'info';
      }
    }
  }

  // Primary status fallback badge
  const primSpec = primaryBadge(item);
  const primLabel = primSpec.labelKey ? t(primSpec.labelKey) : humanize(primSpec.raw ?? '');

  // Deep statuses: Health, Production, Lactation, Reproduction
  const hlthBadgeSpec = healthBadge(item.healthStatus);
  const hlthLabel = hlthBadgeSpec
    ? hlthBadgeSpec.labelKey
      ? t(hlthBadgeSpec.labelKey)
      : humanize(hlthBadgeSpec.raw ?? '')
    : null;

  const prodBadgeSpec = productionBadge(item.productionStatus);
  const prodLabel = prodBadgeSpec
    ? prodBadgeSpec.labelKey
      ? t(prodBadgeSpec.labelKey)
      : humanize(prodBadgeSpec.raw ?? '')
    : null;

  const lactBadgeSpec = lactationBadge(item.lactationStage);
  const lactLabel = lactBadgeSpec
    ? lactBadgeSpec.labelKey
      ? t(lactBadgeSpec.labelKey)
      : humanize(lactBadgeSpec.raw ?? '')
    : null;

  const reproBadgeSpec = reproBadge(item.reproductiveStatus);
  const reproLabel = reproBadgeSpec
    ? reproBadgeSpec.labelKey
      ? t(reproBadgeSpec.labelKey)
      : humanize(reproBadgeSpec.raw ?? '')
    : null;

  const cardA11yLabel = [title, categoryLabel, hlthLabel, prodLabel].filter(Boolean).join(', ');

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* 1. Card Body: Tapping navigates to /cattle/[id] */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityLabel={cardA11yLabel}
        pressedStyle="overlay"
        disabled={disabled}
        onPress={() => onSelect(item)}
        testID={cardTestID}
        focusInset
        style={{
          padding: tokens.spacing.md,
          gap: tokens.spacing.sm,
          borderTopLeftRadius: tokens.radius.lg - 1,
          borderTopRightRadius: tokens.radius.lg - 1,
        }}
      >
        {/* Header: Avatar + Category & Health + Name/Gender & Breed + AQR Score Box */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.sm }}>
          {/* Left: Tinted Avatar */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: tokens.radius.md,
              backgroundColor: tint.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text role="title" style={{ color: tint.text, fontWeight: '800', fontSize: 20 }}>
              {initial}
            </Text>
          </View>

          {/* Middle: Category Pill + Health Badge, Name + Gender, Breed */}
          <View style={{ flex: 1, gap: 3 }}>
            {/* Top Category + Health Status + Primary Badge Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {categoryLabel ? (
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: tokens.radius.full,
                    backgroundColor: colors.muted,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text role="caption" color="foreground" style={{ fontSize: 10, fontWeight: '700' }}>
                    {categoryLabel}
                  </Text>
                </View>
              ) : null}

              {/* Health Status Badge prominently visible in summary */}
              {hlthBadgeSpec && hlthLabel ? (
                'herdState' in hlthBadgeSpec ? (
                  <StatusBadge herdState={hlthBadgeSpec.herdState} label={hlthLabel} />
                ) : (
                  <StatusBadge tone={hlthBadgeSpec.tone} label={hlthLabel} />
                )
              ) : null}

              {/* Primary / Exit status if different from health status (e.g. Milking, Dry, Sold) */}
              {primSpec && primLabel && primLabel !== hlthLabel ? (
                'herdState' in primSpec ? (
                  <StatusBadge herdState={primSpec.herdState} label={primLabel} />
                ) : (
                  <StatusBadge tone={primSpec.tone} label={primLabel} />
                )
              ) : null}
            </View>

            {/* Cow Name / Tag + Gender Glyph */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                role="title"
                color="foreground"
                style={{ fontWeight: '700', fontSize: 16 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
              {item.gender === 'FEMALE' ? (
                <VenusIcon size={14} color={colors.accentPink} />
              ) : item.gender === 'MALE' || item.gender === 'CASTRATED_MALE' ? (
                <MarsIcon size={14} color={colors.info} />
              ) : null}
            </View>

            {/* Subtitle: Breed / details */}
            {subtitleText ? (
              <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
                {subtitleText}
              </Text>
            ) : null}
          </View>

          {/* Right: AQR Score Box */}
          <View
            style={{
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 8,
              paddingVertical: 4,
              alignItems: 'center',
              minWidth: 54,
            }}
          >
            <Text role="caption" color="mutedForeground" style={{ fontSize: 9, fontWeight: '700' }}>
              {t('cattle.card.aqr')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                role="title"
                color="primary"
                style={{ fontWeight: '800', fontSize: 16 }}
              >
                {item.aqrScore !== null ? format.numberSafe(item.aqrScore) : '—'}
              </Text>
              {item.aqrScore !== null ? (
                <Text role="caption" color="mutedForeground" style={{ fontSize: 9, fontWeight: '500' }}>
                  {t('cattle.card.aqrOutOf')}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* 2. Key Metrics Row: Age, Weight, Shed */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.muted,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: tokens.radius.md,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 7,
          }}
        >
          {/* Age */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CalendarIcon size={13} color={colors.mutedForeground} />
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
              {t('cattle.card.age')}:
            </Text>
            <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 11 }}>
              {ageText}
            </Text>
          </View>

          {/* Weight */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ScaleIcon size={13} color={colors.mutedForeground} />
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
              {t('cattle.card.weight')}:
            </Text>
            <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 11 }}>
              {weightText}
            </Text>
          </View>

          {/* Shed */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPinIcon size={13} color={colors.mutedForeground} />
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
              {t('cattle.card.shed')}:
            </Text>
            <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
              {shedText}
            </Text>
          </View>
        </View>

        {/* 3. Next Event Indicator (prominently highlighted if present, subtle clean notice if none) */}
        {nextEventTitle && nextEventDue ? (
          <View
            testID={`${cardTestID}-next-event`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 6,
              borderRadius: tokens.radius.md,
              backgroundColor:
                nextEventUrgency === 'destructive'
                  ? colors.destructiveTint
                  : nextEventUrgency === 'warning'
                    ? colors.warningTint
                    : colors.infoTint,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <ClockIcon
                size={13}
                color={
                  nextEventUrgency === 'destructive'
                    ? colors.destructiveText
                    : nextEventUrgency === 'warning'
                      ? colors.warningText
                      : colors.infoText
                }
              />
              <Text
                role="caption"
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color:
                    nextEventUrgency === 'destructive'
                      ? colors.destructiveText
                      : nextEventUrgency === 'warning'
                        ? colors.warningText
                        : colors.infoText,
                }}
                numberOfLines={1}
              >
                {nextEventTitle}
              </Text>
            </View>
            <Text
              role="caption"
              style={{
                fontSize: 11,
                fontWeight: '700',
                color:
                  nextEventUrgency === 'destructive'
                    ? colors.destructiveText
                    : nextEventUrgency === 'warning'
                      ? colors.warningText
                      : colors.infoText,
              }}
            >
              {nextEventDue}
            </Text>
          </View>
        ) : (
          <View
            testID={`${cardTestID}-no-event`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 5,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <CheckCircleIcon size={13} color={colors.mutedForeground} />
            <Text role="caption" color="mutedForeground" style={{ fontSize: 11, fontWeight: '500' }}>
              {t('cattle.card.noEvents')}
            </Text>
          </View>
        )}

        {/* 4. Expanded Secondary / Deep Statuses Panel (when isExpanded is true) */}
        {isExpanded && (
          <View
            testID={`${cardTestID}-expanded-details`}
            style={{
              backgroundColor: colors.muted,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: tokens.spacing.sm,
              gap: 8,
              marginTop: 2,
            }}
          >
            {/* Production Status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text role="caption" color="mutedForeground" style={{ fontSize: 12, fontWeight: '600' }}>
                {t('cattle.card.production')}
              </Text>
              {prodBadgeSpec && prodLabel ? (
                'herdState' in prodBadgeSpec ? (
                  <StatusBadge herdState={prodBadgeSpec.herdState} label={prodLabel} />
                ) : (
                  <StatusBadge tone={prodBadgeSpec.tone} label={prodLabel} />
                )
              ) : (
                <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>—</Text>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Lactation Stage */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text role="caption" color="mutedForeground" style={{ fontSize: 12, fontWeight: '600' }}>
                {t('cattle.card.lactation')}
              </Text>
              {lactBadgeSpec && lactLabel ? (
                'herdState' in lactBadgeSpec ? (
                  <StatusBadge herdState={lactBadgeSpec.herdState} label={lactLabel} />
                ) : (
                  <StatusBadge tone={lactBadgeSpec.tone} label={lactLabel} />
                )
              ) : (
                <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>—</Text>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Reproduction Status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text role="caption" color="mutedForeground" style={{ fontSize: 12, fontWeight: '600' }}>
                {t('cattle.card.reproduction')}
              </Text>
              {reproBadgeSpec && reproLabel ? (
                'herdState' in reproBadgeSpec ? (
                  <StatusBadge herdState={reproBadgeSpec.herdState} label={reproLabel} />
                ) : (
                  <StatusBadge tone={reproBadgeSpec.tone} label={reproLabel} />
                )
              ) : (
                <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>—</Text>
              )}
            </View>
          </View>
        )}
      </PressableSurface>

      {/* 5. Expand / Collapse Interactive Toggle Button */}
      <PressableSurface
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={
          isExpanded
            ? `${t('cattle.card.lessDetails')}, ${title}`
            : `${t('cattle.card.moreDetails')}, ${title}`
        }
        pressedStyle="overlay"
        disabled={disabled}
        onPress={toggleExpand}
        testID={`${cardTestID}-expand-toggle`}
        focusInset
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: 48,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: tokens.spacing.md,
          borderBottomLeftRadius: tokens.radius.lg - 1,
          borderBottomRightRadius: tokens.radius.lg - 1,
        }}
      >
        <Text role="label" color="primary" style={{ fontSize: 12, fontWeight: '700' }}>
          {isExpanded ? t('cattle.card.lessDetails') : t('cattle.card.moreDetails')}
        </Text>
        {isExpanded ? (
          <ChevronUpIcon size={15} color={colors.primary} />
        ) : (
          <ChevronDownIcon size={15} color={colors.primary} />
        )}
      </PressableSurface>
    </View>
  );
});
