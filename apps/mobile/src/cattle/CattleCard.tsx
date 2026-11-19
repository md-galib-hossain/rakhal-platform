import { memo } from 'react';
import { View } from 'react-native';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
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
  ClockIcon,
  MapPinIcon,
  MarsIcon,
  ScaleIcon,
  VenusIcon,
} from './CattleIcons.tsx';

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

  const primSpec = primaryBadge(item);
  const primLabel = primSpec.labelKey ? t(primSpec.labelKey) : humanize(primSpec.raw ?? '');

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

  const hlthBadgeSpec = healthBadge(item.healthStatus);
  const hlthLabel = hlthBadgeSpec
    ? hlthBadgeSpec.labelKey
      ? t(hlthBadgeSpec.labelKey)
      : humanize(hlthBadgeSpec.raw ?? '')
    : null;

  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${categoryLabel ?? ''}, ${prodLabel ?? ''}, ${hlthLabel ?? ''}`}
      pressedStyle="overlay"
      disabled={disabled}
      onPress={() => onSelect(item)}
      testID={cardTestID}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        gap: tokens.spacing.sm,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* 1. Header: Avatar + Category/Production + Name/Gender + AQR Score Box */}
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

        {/* Middle: Name, Gender, Tags & Category */}
        <View style={{ flex: 1, gap: 2 }}>
          {/* Top Category / Production Pill Row */}
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
                <Text role="caption" color="foreground" style={{ fontSize: 10, fontWeight: '600' }}>
                  {categoryLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Cow Name + Gender Glyph */}
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

          {/* Subtitle: Tag number / Breed */}
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

      {/* 2. Metadata Attributes Row: Age, Weight, Shed */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: tokens.radius.md,
          paddingHorizontal: tokens.spacing.sm,
          paddingVertical: 6,
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

      {/* 3. Next Event Chip (if present) */}
      {nextEventTitle && nextEventDue ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 5,
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
      ) : null}

      {/* 4. Bottom Status Badges Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
        {primSpec && primLabel ? (
          'herdState' in primSpec ? (
            <StatusBadge herdState={primSpec.herdState} label={primLabel} />
          ) : (
            <StatusBadge tone={primSpec.tone} label={primLabel} />
          )
        ) : null}

        {lactBadgeSpec && lactLabel && lactLabel !== primLabel ? (
          'herdState' in lactBadgeSpec ? (
            <StatusBadge herdState={lactBadgeSpec.herdState} label={lactLabel} />
          ) : (
            <StatusBadge tone={lactBadgeSpec.tone} label={lactLabel} />
          )
        ) : null}

        {reproBadgeSpec && reproLabel && reproLabel !== primLabel ? (
          'herdState' in reproBadgeSpec ? (
            <StatusBadge herdState={reproBadgeSpec.herdState} label={reproLabel} />
          ) : (
            <StatusBadge tone={reproBadgeSpec.tone} label={reproLabel} />
          )
        ) : null}

        {hlthBadgeSpec && hlthLabel && hlthLabel !== primLabel && item.healthStatus !== 'HEALTHY' ? (
          'herdState' in hlthBadgeSpec ? (
            <StatusBadge herdState={hlthBadgeSpec.herdState} label={hlthLabel} />
          ) : (
            <StatusBadge tone={hlthBadgeSpec.tone} label={hlthLabel} />
          )
        ) : null}
      </View>
    </PressableSurface>
  );
});
