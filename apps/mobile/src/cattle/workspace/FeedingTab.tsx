/**
 * FeedingTab: Tab 3 of the Animal Workspace.
 * Renders:
 * 1. Nutrition requirements summary
 * 2. Intake & Energy table (Dry matter DMI, ME, NEL, Energy density)
 * 3. Protein table (Crude protein CP, Protein share, RDP, RUP)
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { View } from 'react-native';
import { Card } from '../../components/display/Card.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { type ColorTokens } from '../../theme/tokens.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { categoryKey } from '../cattle-model.ts';
import { WheatIcon } from '../CattleIcons.tsx';

export interface FeedingTabProps {
  detail: CattleDetail;
  testID?: string;
}

export function FeedingTab({ detail, testID = 'tab-feeding' }: FeedingTabProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const req = detail.feedRequirement;

  return (
    <View testID={testID} style={{ gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
      {/* 1. Nutrition Overview Summary */}
      <Card testID="card-feeding-summary">
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <WheatIcon size={18} color={colors.accentTeal} />
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.feeding.nutritionTitle')}
            </Text>
          </View>
          <Text role="body" style={{ color: colors.mutedForeground }}>
            {detail.animalCategory && categoryKey(detail.animalCategory) ? t(categoryKey(detail.animalCategory)!) : ''}{' '}
            {t('cattle.workspace.tabs.feeding')}
          </Text>
        </View>
      </Card>

      {/* 2. Intake & Energy Table */}
      <Card testID="card-intake-energy">
        <View style={{ gap: 12 }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.feeding.intakeEnergy')}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <NutrientRow
              label={t('cattle.workspace.feeding.dmi')}
              value={req?.dm_kg != null ? `${format.numberSafe(req.dm_kg, { fractionDigits: 1 })} ${t('cattle.unit.kg')}` : '—'}
              colors={colors}
            />
            <NutrientRow
              label={t('cattle.workspace.feeding.me')}
              value={req?.me_mj != null ? `${format.numberSafe(req.me_mj, { fractionDigits: 1 })} MJ` : '—'}
              colors={colors}
            />
            <NutrientRow
              label={t('cattle.workspace.feeding.nel')}
              value={req?.ne_mcal != null ? `${format.numberSafe(req.ne_mcal, { fractionDigits: 1 })} Mcal` : '—'}
              colors={colors}
            />
            <NutrientRow
              label={t('cattle.workspace.feeding.density')}
              value={req?.energy_density_mj_per_kg_dm != null ? `${format.numberSafe(req.energy_density_mj_per_kg_dm, { fractionDigits: 1 })} MJ/kg DM` : '—'}
              colors={colors}
            />
          </View>
        </View>
      </Card>

      {/* 3. Protein Table */}
      <Card testID="card-protein">
        <View style={{ gap: 12 }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.feeding.protein')}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <NutrientRow
              label={t('cattle.workspace.feeding.cp')}
              value={req?.cp_kg != null ? `${format.numberSafe(req.cp_kg, { fractionDigits: 2 })} ${t('cattle.unit.kg')}` : '—'}
              colors={colors}
            />
            <NutrientRow
              label={t('cattle.workspace.feeding.proteinShare')}
              value={req?.cp_pct_of_dm != null ? `${format.numberSafe(req.cp_pct_of_dm, { fractionDigits: 1 })}%` : '—'}
              colors={colors}
            />
            <NutrientRow
              label={t('cattle.workspace.feeding.rdp')}
              value={req?.rdp_pct != null ? `${format.numberSafe(req.rdp_pct, { fractionDigits: 1 })}%` : '—'}
              colors={colors}
            />
            <NutrientRow
              label={t('cattle.workspace.feeding.rup')}
              value={req?.rup_pct != null ? `${format.numberSafe(req.rup_pct, { fractionDigits: 1 })}%` : '—'}
              colors={colors}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

function NutrientRow({ label, value, colors }: { label: string; value: string; colors: ColorTokens }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text role="body" style={{ color: colors.foreground }}>
        {label}
      </Text>
      <Text role="body" style={{ fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  );
}
