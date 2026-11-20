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
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  EventKindIcon,
  MapPinIcon,
  MarsIcon,
  ScaleIcon,
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
  const [contentHeight, setContentHeight] = useState(115);

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
      duration: isExpanded ? 220 : 180,
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

  const cardA11yLabel = [displayName, item.tagNumber, categoryLabel, item.breedName, hlthLabel, prodLabel].filter(Boolean).join(', ');

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: isSelected ? 1.5 : 1,
        borderColor: isSelected ? colors.primary : colors.border,
        borderRadius: tokens.radius.lg,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* 1. Card Top Surface: Tapping navigates to /cattle/[id] or toggles selection */}
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
          borderTopLeftRadius: tokens.radius.lg - 1,
          borderTopRightRadius: tokens.radius.lg - 1,
        }}
      >
        {/* Header: [Selection Checkbox] + Avatar + Identity (Name+Gender, Tag · Category · Breed) + AQR Score Box */}
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

          {/* Middle: Line 1 Name+Gender, Line 2 Tag · Category · Breed */}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            {/* Line 1: Cow Name + Gender Glyph */}
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

            {/* Line 2: Tag number · Category pill · Breed */}
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

          {/* Right: AQR Score Box (Fixed width, zero overlap) */}
          <View
            style={{
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              paddingHorizontal: 8,
              paddingVertical: 4,
              alignItems: 'center',
              width: 58,
              flexShrink: 0,
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
      </PressableSurface>

      {/* 2. Middle Section: Unified Status Table */}
      <View
        style={{
          paddingHorizontal: tokens.spacing.md,
          paddingBottom: 6,
        }}
      >
        <View
          testID={isExpanded ? `${cardTestID}-expanded-details` : undefined}
          style={{
            backgroundColor: colors.muted,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: tokens.spacing.sm,
            paddingVertical: 7,
            gap: 6,
          }}
        >
          {/* 1. Health Status Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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

          {/* 2. Production Status Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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

          {/* 3, 4 & 5: Lactation, Reproduction, and Next Event rows (visible in expanded mode via animated accordion) */}
          <Animated.View
            aria-hidden={!isExpanded}
            pointerEvents={isExpanded ? 'auto' : 'none'}
            style={{
              height: animHeight,
              opacity: animOpacity,
              marginTop: animMarginTop,
              overflow: 'hidden',
            }}
          >
            <View
              onLayout={(event) => {
                const h = event.nativeEvent.layout.height;
                if (h > 0 && Math.abs(h - contentHeight) > 1) {
                  setContentHeight(h);
                }
              }}
              style={{ gap: 6 }}
            >
              <View style={{ height: 1, backgroundColor: colors.border }} />

              {/* 3. Lactation Stage Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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

              {/* 4. Reproduction Status Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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

              <View style={{ height: 1, backgroundColor: colors.border }} />

              {/* 5. Next Event Row (Expanded mode only) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text role="caption" color="mutedForeground" style={{ fontSize: 12, fontWeight: '600', flexShrink: 0 }}>
                  {t('cattle.card.nextEvent')}
                </Text>
                <View style={{ flexShrink: 1, alignItems: 'flex-end', maxWidth: '70%' }}>
                  {item.nextEvent && nextEventDue && nextEventTitle ? (
                    <PressableSurface
                      accessibilityRole="button"
                      accessibilityLabel={`${nextEventTitle}, ${nextEventDue.text}`}
                      pressedStyle="overlay"
                      disabled={disabled}
                      onPress={() => onOpenUpcomingEvents?.(item)}
                      testID={`${cardTestID}-next-event`}
                      focusInset
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: tokens.radius.full,
                        borderWidth: 1,
                        borderColor: nextToneColors.border,
                        backgroundColor: nextToneColors.bg,
                        overflow: 'hidden',
                        flexShrink: 1,
                        maxWidth: '100%',
                      }}
                    >
                      <View style={{ flexShrink: 0 }}>
                        <EventKindIcon kind={item.nextEvent.kind} size={12} color={nextToneColors.text} />
                      </View>
                      <Text
                        role="caption"
                        style={{
                          flexShrink: 1,
                          minWidth: 0,
                          fontSize: 11,
                          fontWeight: '600',
                          color: nextToneColors.text,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {nextEventTitle}
                      </Text>
                      <Text
                        role="caption"
                        style={{
                          flexShrink: 0,
                          fontSize: 11,
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
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        borderRadius: tokens.radius.full,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <CheckCircleIcon size={11} color={colors.mutedForeground} />
                      <Text role="caption" color="mutedForeground" style={{ fontSize: 10, fontWeight: '500' }}>
                        {t('cattle.card.noEvents')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* 3. Expand / Collapse Compact Interactive Toggle Button */}
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
        hitSlop={{ top: 10, bottom: 10, left: 24, right: 24 }}
        focusInset
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingVertical: 7,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          borderBottomLeftRadius: tokens.radius.lg - 1,
          borderBottomRightRadius: tokens.radius.lg - 1,
        }}
      >
        <Text role="caption" color="primary" style={{ fontSize: 11, fontWeight: '600' }}>
          {isExpanded ? t('cattle.card.lessDetails') : t('cattle.card.moreDetails')}
        </Text>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <ChevronDownIcon size={12} color={colors.primary} />
        </Animated.View>
      </PressableSurface>
    </View>
  );
});
