import { memo } from 'react';
import { ScrollView, View } from 'react-native';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import {
  CATTLE_CATEGORY_CHIP_KEYS,
  type CattleCategoryChipKey,
  type CattleHighlightsData,
} from './cattle-model.ts';
import {
  AwardIcon,
  CowIcon,
  DropletsIcon,
  HeartPulseIcon,
  TrendingUpIcon,
  UsersIcon,
} from './CattleIcons.tsx';

export interface CattleHighlightsBarProps {
  highlights: CattleHighlightsData;
  categoryCounts: Record<CattleCategoryChipKey, number>;
  selectedCategory: CattleCategoryChipKey;
  onSelectCategory: (category: CattleCategoryChipKey) => void;
  testID?: string;
}

const CHIP_I18N_KEYS: Record<CattleCategoryChipKey, MessageKey> = {
  ALL: 'cattle.chip.all',
  COW: 'cattle.chip.cow',
  HEIFER: 'cattle.chip.heifer',
  CALF: 'cattle.chip.calf',
  WEANED: 'cattle.chip.weaned',
  MALE: 'cattle.chip.male',
  FEMALE: 'cattle.chip.female',
  PREGNANT: 'cattle.chip.pregnant',
  MILKING: 'cattle.chip.milking',
  DRY: 'cattle.chip.dry',
  FRESH: 'cattle.chip.fresh',
  OPEN: 'cattle.chip.open',
  SICK: 'cattle.chip.sick',
};

export const CattleHighlightsBar = memo(function CattleHighlightsBar({
  highlights,
  categoryCounts,
  selectedCategory,
  onSelectCategory,
  testID = 'cattle-highlights-bar',
}: CattleHighlightsBarProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: tokens.radius.lg,
        padding: tokens.spacing.md,
        gap: tokens.spacing.md,
      }}
    >
      {/* Title */}
      <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
        {t('cattle.highlights.title')}
      </Text>

      {/* 2x2 KPI Grid */}
      <View style={{ gap: tokens.spacing.xs + 2 }}>
        {/* Row 1 */}
        <View style={{ flexDirection: 'row', gap: tokens.spacing.xs + 2 }}>
          {/* Tile 1: Total Animals */}
          <View
            testID="kpi-total-animals"
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              padding: tokens.spacing.sm,
              gap: tokens.spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: colors.accentIndigoTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CowIcon size={15} color={colors.accentIndigo} />
              </View>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
                {t('cattle.highlights.total')}
              </Text>
            </View>
            <Text role="title" color="foreground" style={{ fontWeight: '800', fontSize: 20 }}>
              {format.numberSafe(highlights.totalActive)}
            </Text>
          </View>

          {/* Tile 2: Avg Herd AQR */}
          <View
            testID="kpi-avg-aqr"
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              padding: tokens.spacing.sm,
              gap: tokens.spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: colors.infoTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUpIcon size={14} color={colors.info} />
              </View>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
                {t('cattle.highlights.avgAqr')}
              </Text>
            </View>
            <Text role="title" color="foreground" style={{ fontWeight: '800', fontSize: 20 }}>
              {highlights.avgHerdAqr !== null ? format.numberSafe(highlights.avgHerdAqr) : '—'}
            </Text>
          </View>
        </View>

        {/* Row 2 */}
        <View style={{ flexDirection: 'row', gap: tokens.spacing.xs + 2 }}>
          {/* Tile 3: Breeding Ready */}
          <View
            testID="kpi-breeding-ready"
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              padding: tokens.spacing.sm,
              gap: tokens.spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: colors.accentPurpleTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HeartPulseIcon size={14} color={colors.accentPurple} />
              </View>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
                {t('cattle.highlights.breedingReady')}
              </Text>
            </View>
            <Text role="title" color="foreground" style={{ fontWeight: '800', fontSize: 20 }}>
              {format.numberSafe(highlights.breedingReadyCount)}
            </Text>
          </View>

          {/* Tile 4: Milking Cows */}
          <View
            testID="kpi-milking-cows"
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              padding: tokens.spacing.sm,
              gap: tokens.spacing.xs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: colors.successTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DropletsIcon size={14} color={colors.primaryText} />
              </View>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '600', fontSize: 11 }} numberOfLines={1}>
                {t('cattle.highlights.milking')}
              </Text>
            </View>
            <Text role="title" color="foreground" style={{ fontWeight: '800', fontSize: 20 }}>
              {format.numberSafe(highlights.milkingCount)}
            </Text>
          </View>
        </View>
      </View>

      {/* Category Pills (Horizontal Scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: tokens.spacing.xs, paddingVertical: 2 }}
        testID="cattle-category-chips"
      >
        {CATTLE_CATEGORY_CHIP_KEYS.map((key) => {
          const isSelected = selectedCategory === key;
          const count = categoryCounts[key] ?? 0;
          return (
            <PressableSurface
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${t(CHIP_I18N_KEYS[key])}, ${count}`}
              pressedStyle="overlay"
              onPress={() => onSelectCategory(key)}
              testID={`category-chip-${key}`}
              hitSlop={tokens.spacing.xs}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: tokens.radius.full,
                borderWidth: isSelected ? 1.5 : 1,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.successTint : colors.card,
                minHeight: 40,
              }}
            >
              <Text
                role="caption"
                style={{
                  fontWeight: isSelected ? '700' : '500',
                  color: isSelected ? colors.primaryText : colors.foreground,
                  fontSize: 12,
                }}
              >
                {t(CHIP_I18N_KEYS[key])}
              </Text>
              <View
                style={{
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: tokens.radius.full,
                  backgroundColor: isSelected ? colors.card : colors.muted,
                }}
              >
                <Text
                  role="caption"
                  style={{
                    fontSize: 10,
                    fontWeight: isSelected ? '700' : '600',
                    color: isSelected ? colors.primaryText : colors.mutedForeground,
                  }}
                >
                  {format.numberSafe(count)}
                </Text>
              </View>
            </PressableSurface>
          );
        })}
      </ScrollView>
    </View>
  );
});
