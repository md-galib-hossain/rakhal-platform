/**
 * WorkspaceHeader: Complete header for mobile animal workspace.
 * Avatar with tint fallback, name, tag number pill, subtitle,
 * priority status badges (Milk Hold, Production, Repro),
 * quick action buttons (Bell Remind Me, Edit), and More menu (Dispose, Delete).
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { View } from 'react-native';
import { StatusBadge } from '../../components/display/StatusBadge.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import { avatarTint } from '../avatar-tint.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { categoryKey } from '../cattle-model.ts';

export interface WorkspaceHeaderProps {
  detail: CattleDetail;
  onRemindMe?: () => void;
  onEdit?: () => void;
  onDispose?: () => void;
  onDelete?: () => void;
  testID?: string;
}

function normalizeLactationStage(stage?: string | null): 'FRESH' | 'EARLY' | 'MID' | 'LATE' | 'DRY_PERIOD' | null {
  if (!stage) return null;
  const s = stage.trim().toUpperCase();
  if (s === 'LATE' || s === 'LATE_LACTATION') return 'LATE';
  if (s === 'MID' || s === 'MID_LACTATION') return 'MID';
  if (s === 'EARLY' || s === 'EARLY_LACTATION') return 'EARLY';
  if (s === 'FRESH') return 'FRESH';
  if (s === 'DRY_PERIOD' || s === 'DRY') return 'DRY_PERIOD';
  return null;
}

export function WorkspaceHeader({
  detail,
  testID = 'workspace-header',
}: WorkspaceHeaderProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const tint = avatarTint(detail.id, colors);
  const initial = (detail.name ?? detail.tagNumber ?? 'C').charAt(0).toUpperCase();

  // Subtitle: {age} · {category} · {lactationNumber}
  const parts: string[] = [];
  if (detail.age) {
    parts.push(t('cattle.age', { years: format.numberSafe(detail.age.years), months: format.numberSafe(detail.age.months) }));
  }
  const catKey = categoryKey(detail.animalCategory);
  if (catKey) {
    parts.push(t(catKey));
  }
  if (detail.reproduction?.currentLactation) {
    parts.push(t('cattle.workspace.lactationNumber', { n: format.numberSafe(detail.reproduction.currentLactation) }));
  }
  const subtitle = parts.join(' · ');

  // Predictable lifecycle snapshot chips:
  // 1. Milk Hold (safety/risk first)
  // 2. Production Status (Milking / Dry) - no DIM inside the chip, DIM lives in the 4-box stat section below
  // 3. Lactation Stage (Late lactation / Mid lactation / Early lactation / Fresh / Dry period)
  // 4. Pregnancy (Pregnant) only when pregnancy is confirmed
  const productionLabel =
    detail.productionStatus === 'MILKING'
      ? t('cattle.workspace.milking')
      : detail.productionStatus === 'DRY'
        ? t('cattle.workspace.dry')
        : detail.productionStatus;

  const stageKey = normalizeLactationStage(detail.lactationStage);
  const lactationLabel = stageKey
    ? stageKey === 'FRESH'
      ? t('cattle.lactation.fresh')
      : stageKey === 'EARLY'
        ? t('cattle.lactation.early')
        : stageKey === 'MID'
          ? t('cattle.lactation.mid')
          : stageKey === 'LATE'
            ? t('cattle.lactation.late')
            : stageKey === 'DRY_PERIOD'
              ? t('cattle.lactation.dryPeriod')
              : null
    : null;

  const isPregnant = detail.reproductiveStatus === 'PREGNANT';
  const pregnantLabel = isPregnant ? t('cattle.workspace.pregnant') : null;

  return (
    <View
      testID={testID}
      style={{
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        backgroundColor: colors.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Identity row: Avatar + Name/Tag pill + Subtitle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Avatar */}
        <View
          testID="workspace-avatar"
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: tint.bg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text role="h2" style={{ color: tint.text, fontWeight: '700' }}>
            {initial}
          </Text>
        </View>

        {/* Name and Tag (Line 1) + Subtitle (Line 2) */}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text role="title" style={{ fontWeight: '700', fontSize: 18 }} numberOfLines={1}>
              {detail.name || detail.tagNumber}
            </Text>
            {detail.tagNumber ? (
              <View
                testID="workspace-tag-pill"
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text role="caption" style={{ color: colors.mutedForeground, fontWeight: '600', fontSize: 11 }}>
                  {detail.tagNumber}
                </Text>
              </View>
            ) : null}
          </View>

          {subtitle ? (
            <Text role="caption" style={{ color: colors.mutedForeground }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Priority state badges row (predictable lifecycle snapshot) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {detail.hasMilkHold ? (
          <StatusBadge tone="destructive" label={t('cattle.workspace.milkHold')} testID="badge-milk-hold" />
        ) : null}
        {productionLabel ? (
          <StatusBadge
            tone={detail.productionStatus === 'MILKING' ? 'info' : 'warning'}
            label={productionLabel}
            testID="badge-production"
          />
        ) : null}
        {lactationLabel ? (
          <StatusBadge
            tone="neutral"
            label={lactationLabel}
            testID="badge-lactation"
          />
        ) : null}
        {pregnantLabel ? (
          <StatusBadge
            tone="success"
            label={pregnantLabel}
            testID="badge-pregnant"
          />
        ) : null}
      </View>
    </View>
  );
}
