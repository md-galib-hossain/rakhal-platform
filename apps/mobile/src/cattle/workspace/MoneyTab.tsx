/**
 * MoneyTab: Tab 5 of the Animal Workspace.
 * Renders:
 * 1. Financial KPIs: Total Income, Total Cost, Net Profit (BDT color coded)
 * 2. Month pagination (< 2026-11 >)
 * 3. Expense and Income category breakdowns with proportion bars
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/display/Card.tsx';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, type ColorTokens } from '../../theme/tokens.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { ChevronLeftIcon, ChevronRightIcon } from '../CattleIcons.tsx';

export interface MoneyTabProps {
  detail: CattleDetail;
  testID?: string;
}

export function MoneyTab({ detail, testID = 'tab-money' }: MoneyTabProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const finance = detail.finance;
  const [monthOffset, setMonthOffset] = useState(0);

  const totalIncome = finance?.total_income ?? 0;
  const totalCost = finance?.total_cost ?? 0;
  const netProfit = finance?.net_profit ?? 0;
  const period = finance?.period || '2026-11';

  const expenses = finance?.expense_breakdown ?? { feed: 0, health: 0, breeding: 0, others: 0 };
  const income = finance?.income_breakdown ?? { milk_sales: 0, calf_sales: 0 };

  const expenseTotal = (expenses.feed || 0) + (expenses.health || 0) + (expenses.breeding || 0) + (expenses.others || 0);
  const incomeTotal = (income.milk_sales || 0) + (income.calf_sales || 0);

  return (
    <View testID={testID} style={{ gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
      {/* 1. Top Financial KPIs */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, padding: 12 }}>
          <Text role="caption" style={{ color: colors.mutedForeground, fontWeight: '600' }}>
            {t('cattle.workspace.money.totalIncome')}
          </Text>
          <Text role="h2" style={{ fontWeight: '700', color: colors.primaryText, marginTop: 4 }}>
            {format.moneySafe(totalIncome)}
          </Text>
        </Card>

        <Card style={{ flex: 1, padding: 12 }}>
          <Text role="caption" style={{ color: colors.mutedForeground, fontWeight: '600' }}>
            {t('cattle.workspace.money.totalCost')}
          </Text>
          <Text role="h2" style={{ fontWeight: '700', color: colors.destructiveText, marginTop: 4 }}>
            {format.moneySafe(totalCost)}
          </Text>
        </Card>

        <Card style={{ flex: 1, padding: 12 }}>
          <Text role="caption" style={{ color: colors.mutedForeground, fontWeight: '600' }}>
            {t('cattle.workspace.money.netProfit')}
          </Text>
          <Text
            role="h2"
            style={{
              fontWeight: '700',
              color: netProfit >= 0 ? colors.primaryText : colors.destructiveText,
              marginTop: 4,
            }}
          >
            {format.moneySafe(netProfit)}
          </Text>
        </Card>
      </View>

      {/* 2. Month pagination */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: radius.md,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text role="body" style={{ fontWeight: '700' }}>
          {period}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            accessibilityLabel={t('common.previous')}
            onPress={() => setMonthOffset((o) => o - 1)}
            testID="btn-prev-month"
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <ChevronLeftIcon size={18} color={colors.foreground} />
          </PressableSurface>

          <PressableSurface
            accessibilityRole="button"
            pressedStyle="overlay"
            accessibilityLabel={t('common.next')}
            onPress={() => setMonthOffset((o) => Math.min(o + 1, 0))}
            disabled={monthOffset >= 0}
            testID="btn-next-month"
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.muted,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: monthOffset >= 0 ? 0.4 : 1,
            }}
          >
            <ChevronRightIcon size={18} color={colors.foreground} />
          </PressableSurface>
        </View>
      </View>

      {/* 3. Expense Breakdown */}
      <Card testID="card-expense-breakdown">
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: 10,
            }}
          >
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.money.expenses')}
            </Text>
            <Text role="body" style={{ fontWeight: '700', color: colors.destructiveText }}>
              {format.moneySafe(expenseTotal)}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <BreakdownRow
              label={t('cattle.workspace.money.feed')}
              amount={expenses.feed}
              total={expenseTotal}
              format={format}
              colors={colors}
              barColor={colors.warning}
            />
            <BreakdownRow
              label={t('cattle.workspace.money.health')}
              amount={expenses.health}
              total={expenseTotal}
              format={format}
              colors={colors}
              barColor={colors.destructive}
            />
            <BreakdownRow
              label={t('cattle.workspace.money.breeding')}
              amount={expenses.breeding}
              total={expenseTotal}
              format={format}
              colors={colors}
              barColor={colors.accentPurple}
            />
            <BreakdownRow
              label={t('cattle.workspace.money.others')}
              amount={expenses.others}
              total={expenseTotal}
              format={format}
              colors={colors}
              barColor={colors.mutedForeground}
            />
          </View>
        </View>
      </Card>

      {/* 4. Income Breakdown */}
      <Card testID="card-income-breakdown">
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: 10,
            }}
          >
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.money.income')}
            </Text>
            <Text role="body" style={{ fontWeight: '700', color: colors.primaryText }}>
              {format.moneySafe(incomeTotal)}
            </Text>
          </View>

          <View style={{ gap: 8 }}>
            <BreakdownRow
              label={t('cattle.workspace.money.milkSales')}
              amount={income.milk_sales}
              total={incomeTotal}
              format={format}
              colors={colors}
              barColor={colors.primary}
            />
            <BreakdownRow
              label={t('cattle.workspace.money.calfSales')}
              amount={income.calf_sales}
              total={incomeTotal}
              format={format}
              colors={colors}
              barColor={colors.info}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

function BreakdownRow({
  label,
  amount,
  total,
  format,
  colors,
  barColor,
}: {
  label: string;
  amount: number;
  total: number;
  format: ReturnType<typeof useFormat>;
  colors: ColorTokens;
  barColor: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((amount / total) * 100)) : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text role="body" style={{ color: colors.foreground }}>
          {label}
        </Text>
        <Text role="body" style={{ fontWeight: '600' }}>
          {format.moneySafe(amount)}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: colors.muted,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: barColor,
            borderRadius: radius.full,
          }}
        />
      </View>
    </View>
  );
}
