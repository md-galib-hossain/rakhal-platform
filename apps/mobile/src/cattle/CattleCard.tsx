import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Glyph } from '../components/internal/Glyph.tsx';
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
  formatNextEventDue,
  formatNextEventTitle,
  healthBadge,
  humanize,
  lactationBadge,
  productionBadge,
  reproBadge,
  type CattleListItem,
} from './cattle-model.ts';
import {
  ArrowRightIcon,
  BarChartIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DnaIcon,
  DropletsIcon,
  EventKindIcon,
  HeartPulseIcon,
  MapPinIcon,
  MarsIcon,
  MilkIcon,
  ScaleIcon,
  StethoscopeIcon,
  TrendingUpIcon,
  VenusIcon,
} from './CattleIcons.tsx';

export interface CattleCardProps {
  item: CattleListItem;
  onSelect: (item: CattleListItem) => void;
  onOpenUpcomingEvents?: (item: CattleListItem) => void;
  disabled?: boolean;
  testID?: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: CattleListItem) => void;
  onLongPress?: (item: CattleListItem) => void;
}

type AccordionTab = 'OVERVIEW' | 'HEALTH' | 'MILK' | 'REPRODUCTION';

export const CattleCard = memo(function CattleCard({
  item,
  onSelect,
  onOpenUpcomingEvents,
  disabled = false,
  testID,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPress,
}: CattleCardProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const reduceMotion = useReduceMotion();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(240);
  const [activeTab, setActiveTab] = useState<AccordionTab>('OVERVIEW');

  const animProgress = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (reduceMotion) {
      animProgress.setValue(isExpanded ? 1 : 0);
      return;
    }

    const anim = Animated.timing(animProgress, {
      toValue: isExpanded ? 1 : 0,
      duration: isExpanded ? 240 : 180,
      easing: isExpanded ? Easing.bezier(0.2, 0, 0, 1) : Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [isExpanded, reduceMotion, animProgress]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const animHeight = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight],
  });

  const animOpacity = animProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });

  const animMarginTop = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });

  const chevronRotation = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

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

  // Identity hierarchy: Name is primary; Tag & Breed is subtitle
  const hasName = Boolean(item.name?.trim());
  const displayName = hasName ? item.name!.trim() : item.tagNumber;

  // Category & Status Badges
  const categoryMsgKey = categoryKey(item.animalCategory);
  const categoryLabel = categoryMsgKey ? t(categoryMsgKey) : null;

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

  // Next Event formatting
  const nextEventTitle = item.nextEvent ? formatNextEventTitle(item.nextEvent, t) : null;
  const nextEventDue = item.nextEvent ? formatNextEventDue(item.nextEvent.daysUntil, t, format.numberSafe) : null;
  const nextEventUrgency = nextEventDue?.urgency ?? 'muted';

  const nextToneColors =
    nextEventUrgency === 'destructive'
      ? {
          border: colors.destructive,
          bg: colors.destructiveTint,
          text: colors.destructiveText,
        }
      : nextEventUrgency === 'warning'
        ? {
          border: colors.warning,
          bg: colors.warningTint,
          text: colors.warningText,
        }
      : nextEventUrgency === 'info'
        ? {
          border: colors.info,
          bg: colors.infoTint,
          text: colors.infoText,
        }
      : {
          border: colors.border,
          bg: colors.muted,
          text: colors.mutedForeground,
        };

  // Status Indicators
  const isHealthy = item.healthStatus === 'HEALTHY' || item.healthStatus === null;
  const isMilking = item.productionStatus === 'MILKING';

  const cardA11yLabel = [displayName, item.tagNumber, categoryLabel, item.breedName, hlthLabel, prodLabel].filter(Boolean).join(', ');

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: isSelected ? colors.primary : colors.border,
        borderRadius: tokens.radius.lg,
        opacity: disabled ? 0.6 : 1,
        overflow: 'hidden',
      }}
    >
      {/* 1. Main Collapsed Card Body */}
      <PressableSurface
        accessibilityRole={isSelectionMode ? 'checkbox' : 'button'}
        accessibilityState={isSelectionMode ? { checked: isSelected } : undefined}
        accessibilityLabel={cardA11yLabel}
        pressedStyle="overlay"
        disabled={disabled}
        onPress={() => {
          if (isSelectionMode && onToggleSelect) {
            onToggleSelect(item);
          } else {
            onSelect(item);
          }
        }}
        onLongPress={() => {
          if (onLongPress) {
            onLongPress(item);
          }
        }}
        testID={cardTestID}
        focusInset
        style={{
          padding: tokens.spacing.md,
          paddingBottom: tokens.spacing.sm,
          gap: tokens.spacing.sm,
        }}
      >
        {/* Top Header: Avatar + Cow Name/Tag/Gender + AQR Box */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          {isSelectionMode ? (
            <View
              testID={`cattle-select-check-${item.id}`}
              style={{
                width: 24,
                height: 24,
                borderRadius: tokens.radius.full,
                borderWidth: 1.5,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected ? <Glyph name="check" size={16} color="primaryForeground" /> : null}
            </View>
          ) : null}

          {/* Left: Circular Avatar with Status Dot */}
          <View style={{ position: 'relative' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: tokens.radius.full,
                backgroundColor: tint.bg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text role="title" style={{ color: tint.text, fontWeight: '800', fontSize: 20 }}>
                {initial}
              </Text>
            </View>
            {/* Status Dot */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 13,
                height: 13,
                borderRadius: tokens.radius.full,
                backgroundColor: isHealthy ? colors.success : colors.destructive,
                borderWidth: 2,
                borderColor: colors.card,
              }}
            />
          </View>

          {/* Middle: Cow Name + Gender, Farm Tag ID */}
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                role="title"
                color="foreground"
                style={{ fontWeight: '700', fontSize: 16, flexShrink: 1 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
              {item.gender === 'FEMALE' ? (
                <VenusIcon size={14} color={colors.accentPink} />
              ) : item.gender === 'MALE' || item.gender === 'CASTRATED_MALE' ? (
                <MarsIcon size={14} color={colors.info} />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <Text
                role="caption"
                color="mutedForeground"
                style={{ fontSize: 12, fontWeight: '500' }}
                numberOfLines={1}
              >
                {item.tagNumber}
              </Text>

              {categoryLabel ? (
                <>
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                    ·
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 1,
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
                </>
              ) : null}

              {item.breedName ? (
                <>
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                    ·
                  </Text>
                  <Text
                    role="caption"
                    color="mutedForeground"
                    style={{ fontSize: 12 }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.breedName}
                  </Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Right: Prominent AQR Score Box */}
          <View
            style={{
              backgroundColor: colors.successTint,
              borderWidth: 1,
              borderColor: colors.primaryEdge,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 10,
              paddingVertical: 5,
              alignItems: 'center',
              minWidth: 64,
              flexShrink: 0,
            }}
          >
            <Text role="caption" color="primaryText" style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
              {t('cattle.card.aqr')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                role="title"
                color="primary"
                style={{ fontWeight: '900', fontSize: 17 }}
              >
                {item.aqrScore !== null ? format.numberSafe(item.aqrScore) : '—'}
              </Text>
              {item.aqrScore !== null ? (
                <Text role="caption" color="primaryText" style={{ fontSize: 10, fontWeight: '600', opacity: 0.8 }}>
                  {t('cattle.card.aqrOutOf')}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Glanceable Horizontal Metadata Strip: Age · Weight · Shed */}
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
      </PressableSurface>

      {/* Status Strip & Accordion Toggle Bar: Twin Pills on Left + Chevron on Right */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: tokens.spacing.md,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        {/* Left: Twin Pills [ 💚 Healthy ] and [ 💧 Milking ] */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 1 }}>
          {/* Pill 1: Health Status */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: tokens.radius.full,
              backgroundColor: isHealthy ? colors.successTint : colors.destructiveTint,
              borderWidth: 1,
              borderColor: isHealthy ? colors.primaryEdge : colors.destructive,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: tokens.radius.full,
                backgroundColor: isHealthy ? colors.success : colors.destructive,
              }}
            />
            <Text
              role="caption"
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: isHealthy ? colors.primaryText : colors.destructiveText,
              }}
            >
              {hlthLabel ?? t('cattle.card.status.healthy')}
            </Text>
          </View>

          {/* Pill 2: Production / Milking Status */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: tokens.radius.full,
              backgroundColor: isMilking ? colors.infoTint : colors.muted,
              borderWidth: 1,
              borderColor: isMilking ? colors.info : colors.border,
            }}
          >
            <DropletsIcon size={11} color={isMilking ? colors.info : colors.mutedForeground} />
            <Text
              role="caption"
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: isMilking ? colors.infoText : colors.mutedForeground,
              }}
            >
              {prodLabel ?? (isMilking ? t('cattle.card.status.milking') : t('cattle.card.status.notMilking'))}
            </Text>
          </View>
        </View>

        {/* Right: Expand / Collapse Toggle Button */}
        <PressableSurface
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={
            isExpanded
              ? `${t('cattle.card.lessDetails')}, ${displayName}`
              : `${t('cattle.card.moreDetails')}, ${displayName}`
          }
          pressedStyle="overlay"
          disabled={disabled}
          onPress={toggleExpand}
          testID={`${cardTestID}-expand-toggle`}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          focusInset
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: tokens.radius.md,
            backgroundColor: isExpanded ? colors.muted : 'transparent',
          }}
        >
          <Text role="caption" color="primary" style={{ fontSize: 11, fontWeight: '700' }}>
            {isExpanded ? t('cattle.card.lessDetails') : t('cattle.card.moreDetails')}
          </Text>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <ChevronDownIcon size={13} color={colors.primary} />
          </Animated.View>
        </PressableSurface>
      </View>

      {/* 2. Expanded In-Card Accordion Content */}
      <Animated.View
        aria-hidden={!isExpanded}
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={{
          height: animHeight,
          opacity: animOpacity,
          marginTop: animMarginTop,
          overflow: 'hidden',
          backgroundColor: colors.muted,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View
          onLayout={(event) => {
            const h = event.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - contentHeight) > 1) {
              setContentHeight(h);
            }
          }}
          style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}
          testID={isExpanded ? `${cardTestID}-expanded-details` : undefined}
        >
          {/* Sub-tabs: Overview, Health, Milk, Reproduction */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.card,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 3,
              gap: 4,
            }}
          >
            {(
              [
                { key: 'OVERVIEW', label: t('cattle.card.tab.overview'), icon: BarChartIcon },
                { key: 'HEALTH', label: t('cattle.card.tab.health'), icon: StethoscopeIcon },
                { key: 'MILK', label: t('cattle.card.tab.milk'), icon: MilkIcon },
                { key: 'REPRODUCTION', label: t('cattle.card.tab.reproduction'), icon: DnaIcon },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <PressableSurface
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  pressedStyle="overlay"
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingVertical: 6,
                    borderRadius: tokens.radius.sm,
                    backgroundColor: isActive ? colors.successTint : 'transparent',
                    borderWidth: isActive ? 1 : 0,
                    borderColor: colors.primaryEdge,
                  }}
                >
                  <TabIcon size={12} color={isActive ? colors.primaryText : colors.mutedForeground} />
                  <Text
                    role="caption"
                    style={{
                      fontSize: 10,
                      fontWeight: isActive ? '800' : '600',
                      color: isActive ? colors.primaryText : colors.mutedForeground,
                    }}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </PressableSurface>
              );
            })}
          </View>

          {/* Quick Intelligence Tiles (2x2 Grid) */}
          <View style={{ gap: tokens.spacing.xs }}>
            {/* Row 1 of Tiles */}
            <View style={{ flexDirection: 'row', gap: tokens.spacing.xs }}>
              {/* Tile 1: Last Milk Yield */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.sm,
                  gap: 3,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <DropletsIcon size={12} color={colors.info} />
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                    {t('cattle.card.tile.lastMilk')}
                  </Text>
                </View>
                <Text role="body" color="foreground" style={{ fontWeight: '800', fontSize: 13 }}>
                  {isMilking ? `5.0 L (${t('cattle.card.production')})` : '—'}
                </Text>
              </View>

              {/* Tile 2: Next Event */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.sm,
                  gap: 3,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CalendarIcon size={12} color={colors.warning} />
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                    {t('cattle.card.tile.nextEvent')}
                  </Text>
                </View>
                {item.nextEvent && nextEventDue && nextEventTitle ? (
                  <PressableSurface
                    accessibilityRole="button"
                    accessibilityLabel={`${nextEventTitle}, ${nextEventDue.text}`}
                    pressedStyle="overlay"
                    disabled={disabled}
                    onPress={() => onOpenUpcomingEvents?.(item)}
                    testID={`${cardTestID}-next-event`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}
                  >
                    <EventKindIcon kind={item.nextEvent.kind} size={11} color={nextToneColors.text} />
                    <Text
                      role="caption"
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: nextToneColors.text,
                      }}
                      numberOfLines={1}
                    >
                      {nextEventTitle}
                    </Text>
                    <Text
                      role="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: nextToneColors.text,
                      }}
                    >
                      · {nextEventDue.text}
                    </Text>
                  </PressableSurface>
                ) : (
                  <View
                    testID={`${cardTestID}-no-event`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <CheckCircleIcon size={11} color={colors.mutedForeground} />
                    <Text role="caption" color="mutedForeground" style={{ fontSize: 11, fontWeight: '500' }}>
                      {t('cattle.card.noEvents')}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Row 2 of Tiles */}
            <View style={{ flexDirection: 'row', gap: tokens.spacing.xs }}>
              {/* Tile 3: Lactation Stage */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.sm,
                  gap: 3,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MilkIcon size={12} color={colors.accentIndigo} />
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                    {t('cattle.card.lactation')}
                  </Text>
                </View>
                <Text role="body" color="foreground" style={{ fontWeight: '800', fontSize: 13 }}>
                  {lactLabel ?? '—'}
                </Text>
              </View>

              {/* Tile 4: Production Trend */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.md,
                  padding: tokens.spacing.sm,
                  gap: 3,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TrendingUpIcon size={12} color={colors.primary} />
                  <Text role="caption" color="mutedForeground" style={{ fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                    {t('cattle.card.tile.trend')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text role="body" color="primary" style={{ fontWeight: '800', fontSize: 13 }}>
                    {isMilking ? t('cattle.card.trend.stable') : '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Deep Status Table (Visible for detail parity) */}
          <View
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.spacing.sm,
              paddingVertical: 7,
              gap: 6,
            }}
          >
            {/* Health Status Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text role="caption" color="mutedForeground" style={{ fontSize: 12, fontWeight: '600' }}>
                {t('cattle.card.health')}
              </Text>
              {hlthBadgeSpec && hlthLabel ? (
                'herdState' in hlthBadgeSpec ? (
                  <StatusBadge herdState={hlthBadgeSpec.herdState} label={hlthLabel} />
                ) : (
                  <StatusBadge tone={hlthBadgeSpec.tone} label={hlthLabel} />
                )
              ) : (
                <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>—</Text>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Production Status Row */}
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

            {/* Reproduction Status Row */}
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

          {/* Bottom Action: "View Full Details →" Button */}
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={`${t('cattle.card.viewFullDetails')}, ${displayName}`}
            pressedStyle="overlay"
            disabled={disabled}
            onPress={() => onSelect(item)}
            testID={`${cardTestID}-view-full-details`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: tokens.radius.md,
              backgroundColor: colors.primary,
              minHeight: 44,
            }}
          >
            <Text role="body" style={{ color: colors.primaryForeground, fontWeight: '700', fontSize: 13 }}>
              {t('cattle.card.viewFullDetails')}
            </Text>
            <ArrowRightIcon size={14} color={colors.primaryForeground} />
          </PressableSurface>
        </View>
      </Animated.View>
    </View>
  );
});
