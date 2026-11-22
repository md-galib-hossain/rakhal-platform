/**
 * WorkspaceStats: Top 4-stat metric grid (2x2) for mobile.
 * Shows:
 * 1. DIM (with since calving date hint)
 * 2. DAYS OPEN / PREGNANT (with expected calving hint or since calving)
 * 3. LAST MILK (with time ago hint)
 * 4. LAST WEIGHT (with time ago hint)
 * Graceful fallbacks for heifers, bulls, calves (Age, BCS, Weight, Breed).
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { View } from 'react-native';
import { Text } from '../../components/primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, type ColorTokens } from '../../theme/tokens.ts';
import { addDaysIso, daysSince, todayIso, type CattleDetail } from '../cattle-detail-model.ts';

export interface WorkspaceStatsProps {
  detail: CattleDetail;
  testID?: string;
}

interface StatCell {
  key: string;
  label: string;
  value: string;
  hint: string;
}

export function WorkspaceStats({ detail, testID = 'workspace-stats' }: WorkspaceStatsProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const isFemale = detail.gender === 'FEMALE';
  const today = todayIso();

  const repro = detail.reproduction;
  const isPregnant = detail.reproductiveStatus === 'PREGNANT';
  const dim = detail.dim ?? repro?.dim ?? null;

  const lastMilk = detail.overview?.recent_milk_records?.[detail.overview.recent_milk_records.length - 1];
  const lastWeight = detail.overview?.weight_history?.[detail.overview.weight_history.length - 1];
  const weightKg = detail.lastWeightKg ?? lastWeight?.weight_kg ?? null;
  const bcs = detail.overview?.bcs_records?.[detail.overview.bcs_records.length - 1]?.score ?? null;

  const agoHint = (iso: string | undefined): string => {
    if (!iso) return t('cattle.workspace.stats.notRecorded');
    const days = daysSince(iso);
    if (days === 0) return t('cattle.workspace.stats.today');
    if (days === 1) return t('cattle.workspace.stats.yesterday');
    return t('cattle.workspace.stats.daysAgo', { days: format.numberSafe(days) });
  };

  const calvedDate = dim != null ? format.dateSafe(Date.parse(addDaysIso(today, -dim))) : null;

  const cells: StatCell[] = [];

  const milkValue =
    detail.avgDailyYield7d != null
      ? `${format.numberSafe(detail.avgDailyYield7d, { fractionDigits: 1 })} ${t('cattle.unit.litre')}`
      : lastMilk?.total_l != null
        ? `${format.numberSafe(lastMilk.total_l, { fractionDigits: 1 })} ${t('cattle.unit.litre')}`
        : '—';

  const weightValue = weightKg != null ? `${format.numberSafe(weightKg)} ${t('cattle.unit.kg')}` : '—';

  if (isFemale && dim != null) {
    cells.push({
      key: 'dim',
      label: t('cattle.workspace.stats.dim'),
      value: format.numberSafe(dim),
      hint: calvedDate ? t('cattle.workspace.stats.since', { date: calvedDate }) : t('cattle.workspace.stats.sinceCalving'),
    });

    if (isPregnant) {
      const days = repro?.daysPregnant != null ? format.numberSafe(repro.daysPregnant) : '—';
      const dueFormatted = repro?.expectedCalvingDate ? format.dateSafe(Date.parse(repro.expectedCalvingDate)) : null;
      cells.push({
        key: 'repro',
        label: t('cattle.workspace.stats.daysPregnant'),
        value: days,
        hint: dueFormatted ? t('cattle.workspace.stats.due', { date: dueFormatted }) : '',
      });
    } else {
      const days = repro?.daysOpen != null ? format.numberSafe(repro.daysOpen) : format.numberSafe(dim);
      cells.push({
        key: 'repro',
        label: t('cattle.workspace.stats.daysOpen'),
        value: days,
        hint: t('cattle.workspace.stats.sinceCalving'),
      });
    }

    cells.push({
      key: 'milk',
      label: t('cattle.workspace.stats.lastMilk'),
      value: milkValue,
      hint: agoHint(lastMilk?.date),
    });

    cells.push({
      key: 'weight',
      label: t('cattle.workspace.stats.lastWeight'),
      value: weightValue,
      hint: agoHint(lastWeight?.date),
    });
  } else {
    // Non-lactating / young heifer / male
    const ageYears = detail.age?.years ?? 0;
    const ageMonths = detail.age?.months ?? 0;
    cells.push({
      key: 'age',
      label: t('cattle.workspace.stats.age'),
      value: detail.age ? t('cattle.age', { years: format.numberSafe(ageYears), months: format.numberSafe(ageMonths) }) : '—',
      hint: detail.dateOfBirth ? format.dateSafe(Date.parse(detail.dateOfBirth)) : t('cattle.workspace.stats.notRecorded'),
    });

    cells.push({
      key: 'bcs',
      label: t('cattle.workspace.stats.bcs'),
      value: bcs != null ? format.numberSafe(bcs, { fractionDigits: 1 }) : '—',
      hint: agoHint(detail.overview?.bcs_records?.[detail.overview.bcs_records.length - 1]?.date),
    });

    cells.push({
      key: 'weight',
      label: t('cattle.workspace.stats.lastWeight'),
      value: weightValue,
      hint: agoHint(lastWeight?.date),
    });

    cells.push({
      key: 'breed',
      label: t('cattle.workspace.stats.breed'),
      value: detail.breedName ?? '—',
      hint: '',
    });
  }

  return (
    <View
      testID={testID}
      style={{
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: radius.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {/* 2x2 grid */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {renderCell(cells[0]!, colors, false)}
        {renderCell(cells[1]!, colors, true)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {renderCell(cells[2]!, colors, false)}
        {renderCell(cells[3]!, colors, true)}
      </View>
    </View>
  );
}

function renderCell(cell: StatCell, colors: ColorTokens, hasLeftBorder: boolean) {
  return (
    <View
      key={cell.key}
      testID={`stat-cell-${cell.key}`}
      style={{
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderLeftWidth: hasLeftBorder ? 1 : 0,
        borderLeftColor: colors.border,
        gap: 2,
      }}
    >
      <Text role="caption" style={{ color: colors.mutedForeground, fontWeight: '600', letterSpacing: 0.5 }}>
        {cell.label}
      </Text>
      <Text role="h2" style={{ fontWeight: '700', color: colors.foreground }}>
        {cell.value}
      </Text>
      <Text role="caption" style={{ color: colors.mutedForeground }} numberOfLines={1}>
        {cell.hint || ' '}
      </Text>
    </View>
  );
}
