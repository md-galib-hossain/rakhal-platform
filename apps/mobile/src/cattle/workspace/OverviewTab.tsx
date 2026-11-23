/**
 * OverviewTab: Tab 1 of the Animal Workspace.
 * Cards:
 * 1. Reproduction Card with 5-phase pipeline, last service, calvings count, +Heat / +AI buttons
 * 2. Milk Card with Today, 7d avg, week total, 7 sparkline bars, +Log milk button
 * 3. Health Card with Healthy/Sick badge, open cases count, active withdrawals, +Report sickness button
 * 4. Growth Card with Weight, 30d delta, BCS, +Weigh button
 * 5. Recent Events Card with 5 recent events, author badge, and "See all" button
 * 6. Next Up Reminders Card with tasks and Snooze/Skip/Record buttons
 * 7. At a Glance Card with key identity facts
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { ScrollView, View } from 'react-native';
import { Button } from '../../components/actions/Button.tsx';
import { Card } from '../../components/display/Card.tsx';
import { StatusBadge } from '../../components/display/StatusBadge.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius, type ColorTokens } from '../../theme/tokens.ts';
import {
  buildPhaseBar,
  calvingsShown,
  milkFigures,
  overviewCards,
  todayIso,
  weightTrend,
  type CattleDetail,
} from '../cattle-detail-model.ts';
import { lactationBadge, reproBadge } from '../cattle-model.ts';
import {
  CalendarClockIcon,
  CheckCircleIcon,
  EventKindIcon,
  HeartPulseIcon,
  MilkIcon,
  ScaleIcon,
  SparklesIcon,
} from '../CattleIcons.tsx';

export interface OverviewTabProps {
  detail: CattleDetail;
  onRecordEvent: (type?: string) => void;
  onSeeAllTimeline: () => void;
  onLogMilk: () => void;
  onInnerScrollActiveChange?: (active: boolean) => void;
  testID?: string;
}

function normalizeLactationStage(stage?: string | null): string | null {
  if (!stage) return null;
  const s = stage.trim().toUpperCase();
  if (s === 'LATE' || s === 'LATE_LACTATION') return 'LATE';
  if (s === 'MID' || s === 'MID_LACTATION') return 'MID';
  if (s === 'EARLY' || s === 'EARLY_LACTATION') return 'EARLY';
  if (s === 'FRESH') return 'FRESH';
  if (s === 'DRY_PERIOD' || s === 'DRY') return 'DRY_PERIOD';
  return s;
}

export function OverviewTab({
  detail,
  onRecordEvent,
  onSeeAllTimeline,
  onLogMilk,
  onInnerScrollActiveChange,
  testID = 'tab-overview',
}: OverviewTabProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const today = todayIso();

  const handleScrollTouchStart = () => {
    onInnerScrollActiveChange?.(true);
  };
  const handleScrollTouchEnd = () => {
    onInnerScrollActiveChange?.(false);
  };
  const handleScrollBeginDrag = () => {
    onInnerScrollActiveChange?.(true);
  };
  const handleScrollEndDrag = () => {
    onInnerScrollActiveChange?.(false);
  };
  const handleMomentumScrollBegin = () => {
    onInnerScrollActiveChange?.(true);
  };
  const handleMomentumScrollEnd = () => {
    onInnerScrollActiveChange?.(false);
  };

  const isFemale = detail.gender === 'FEMALE';
  const isPregnant = detail.reproductiveStatus === 'PREGNANT';
  const applies = overviewCards(detail);

  // Normalized badges for predictable placement
  const reproBadgeSpec = reproBadge(detail.reproductiveStatus);
  const reproText = reproBadgeSpec ? (reproBadgeSpec.labelKey ? t(reproBadgeSpec.labelKey) : reproBadgeSpec.raw) : null;
  const reproTone: 'success' | 'warning' | 'destructive' | 'info' | 'neutral' =
    reproBadgeSpec && 'tone' in reproBadgeSpec
      ? reproBadgeSpec.tone
      : isPregnant
        ? 'success'
        : reproBadgeSpec && 'herdState' in reproBadgeSpec && reproBadgeSpec.herdState === 'insemination'
          ? 'info'
          : 'neutral';

  const normalizedStage = normalizeLactationStage(detail.lactationStage);
  const lactationBadgeSpec = lactationBadge(normalizedStage);
  const lactationText = lactationBadgeSpec ? (lactationBadgeSpec.labelKey ? t(lactationBadgeSpec.labelKey) : lactationBadgeSpec.raw) : null;

  // 1. Reproduction Data & Phase Bar
  const repro = detail.reproduction;
  const bar = isFemale
    ? buildPhaseBar({
        today,
        dim: detail.dim ?? repro?.dim ?? null,
        lastBreeding: repro?.lastBreeding ?? null,
        expectedCalvingDate: repro?.expectedCalvingDate ?? null,
        pregnant: isPregnant,
      })
    : null;

  const calvings = calvingsShown(repro?.totalCalvings, detail.dim ?? repro?.dim ?? null);
  const lastServiceFormatted = repro?.lastBreeding ? format.dateSafe(Date.parse(repro.lastBreeding)) : null;

  // 2. Milk Figures & Sparkline Bars
  const milkData = milkFigures(detail.overview?.recent_milk_records ?? [], today);
  const avgYield = detail.avgDailyYield7d ?? (milkData.weekTotal > 0 ? milkData.weekTotal / 7 : null);
  const maxBar = Math.max(...milkData.series, 1);

  // 3. Health Summary
  const health = detail.health;
  const openCasesCount = health?.activeCases?.length ?? 0;
  const isSick = openCasesCount > 0 || detail.healthStatus === 'SICK';
  const withdrawals = health?.activeWithdrawals ?? [];

  // 4. Growth & Weight
  const weightData = weightTrend(detail.overview?.weight_history ?? [], today);
  const lastWeightVal = detail.lastWeightKg ?? detail.overview?.last_weight_kg;
  const bcsVal = detail.overview?.bcs_records?.[detail.overview.bcs_records.length - 1]?.score;

  // 5. Recent Events (up to 5)
  const recentEvents = (detail.timelineEvents ?? []).slice(0, 5);

  // 6. Next Up Reminders
  const upcomingReminders = detail.upcomingEvents ?? [];

  return (
    <View testID={testID} style={{ gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
      {/* 1. Reproduction Card */}
      {applies.reproduction ? (
        <Card testID="card-reproduction" style={{ minHeight: 210 }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SparklesIcon size={18} color={colors.accentPurple} />
                <Text role="title" style={{ fontWeight: '700' }}>
                  {t('cattle.workspace.overview.reproTitle')}
                </Text>
              </View>
              {reproText ? (
                <StatusBadge tone={reproTone} label={reproText} testID="badge-repro-status" />
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              {lastServiceFormatted ? (
                <Text role="caption" style={{ color: colors.mutedForeground }}>
                  {t('cattle.workspace.overview.lastService', { date: lastServiceFormatted })}
                </Text>
              ) : null}
              {calvings > 0 ? (
                <Text role="caption" style={{ color: colors.mutedForeground }}>
                  {t('cattle.workspace.overview.calvingsCount', { count: format.numberSafe(calvings) })}
                </Text>
              ) : null}
            </View>

            {/* 5-Phase Visual Pipeline or Predictable Placeholder */}
            {bar ? (
              <View testID="repro-phase-pipeline" style={{ paddingVertical: 8, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', position: 'relative' }}>
                  {/* Connecting line */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 16,
                      right: 16,
                      height: 2,
                      backgroundColor: colors.border,
                      zIndex: 0,
                    }}
                  />
                  {bar.markers.map((marker) => (
                    <View key={marker.key} style={{ alignItems: 'center', flex: 1, zIndex: 1 }}>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: radius.full,
                          backgroundColor: marker.recorded ? colors.primary : colors.card,
                          borderWidth: 2,
                          borderColor: colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {marker.recorded ? <CheckCircleIcon size={12} color={colors.primaryForeground} /> : null}
                      </View>
                      <Text role="caption" style={{ fontWeight: '600', marginTop: 4, textAlign: 'center' }}>
                        {t(`cattle.workspace.overview.phase.${marker.key}`)}
                      </Text>
                      <Text role="caption" style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        {format.dateSafe(Date.parse(marker.date))}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View
                style={{
                  minHeight: 62,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: radius.md,
                  backgroundColor: colors.muted,
                  gap: 2,
                }}
              >
                <Text role="caption" style={{ fontWeight: '600', color: colors.foreground }}>
                  {t('cattle.workspace.overview.noBreedingYet')}
                </Text>
                <Text role="caption" style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                  {t('cattle.workspace.overview.recordHeatOrService')}
                </Text>
              </View>
            )}

            {/* Quick action buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Button
                variant="secondary"
                size="md"
                label={t('cattle.workspace.overview.addHeat')}
                onPress={() => onRecordEvent('HEAT')}
                testID="btn-add-heat"
              />
              <Button
                variant="secondary"
                size="md"
                label={t('cattle.workspace.overview.addService')}
                onPress={() => onRecordEvent('SERVICE')}
                testID="btn-add-service"
              />
            </View>
          </View>
        </Card>
      ) : null}

      {/* 2. Milk Production Card */}
      {applies.milk ? (
        <Card testID="card-milk" style={{ minHeight: 180 }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MilkIcon size={18} color={colors.info} />
                <Text role="title" style={{ fontWeight: '700' }}>
                  {t('cattle.workspace.overview.milkTitle')}
                </Text>
              </View>
              <Button
                variant="ghost"
                size="md"
                label={t('cattle.workspace.overview.logMilk')}
                onPress={onLogMilk}
                testID="btn-log-milk"
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <View>
                <Text role="caption" style={{ color: colors.mutedForeground }}>
                  {t('cattle.workspace.overview.todayYield')}
                </Text>
                <Text role="h1" style={{ fontWeight: '700' }}>
                  {milkData.today != null
                    ? `${format.numberSafe(milkData.today, { fractionDigits: 1 })} ${t('cattle.unit.litre')}`
                    : '0.0 L'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text role="caption" style={{ color: colors.mutedForeground }}>
                  {t('cattle.workspace.overview.avg7')}
                </Text>
                <Text role="h2" style={{ fontWeight: '600' }}>
                  {avgYield != null
                    ? `${format.numberSafe(avgYield, { fractionDigits: 1 })} ${t('cattle.unit.litre')}`
                    : '—'}
                </Text>
              </View>
            </View>

            {/* 7 Sparkline mini bars */}
            <View
              testID="milk-sparkline-bars"
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                height: 48,
                gap: 6,
                paddingVertical: 4,
              }}
            >
              {milkData.series.map((val, idx) => {
                const heightPct = Math.max(12, Math.round((val / maxBar) * 100));
                return (
                  <View
                    key={idx}
                    style={{
                      flex: 1,
                      height: `${heightPct}%`,
                      backgroundColor: val > 0 ? colors.primary : colors.muted,
                      borderRadius: radius.sm,
                    }}
                  />
                );
              })}
            </View>

            <Text role="caption" style={{ color: colors.mutedForeground }}>
              {t('cattle.workspace.overview.weekTotal', {
                value: format.numberSafe(milkData.weekTotal, { fractionDigits: 1 }),
              })}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* 3. Health Card */}
      <Card testID="card-health" style={{ minHeight: 180 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HeartPulseIcon size={18} color={isSick ? colors.destructiveText : colors.primaryText} />
              <Text role="title" style={{ fontWeight: '700' }}>
                {t('cattle.workspace.overview.healthTitle')}
              </Text>
            </View>
            <StatusBadge
              tone={isSick ? 'destructive' : 'success'}
              label={isSick ? t('cattle.workspace.overview.sick') : t('cattle.workspace.overview.healthy')}
              testID="health-status-badge"
            />
          </View>

          {openCasesCount > 0 ? (
            <Text role="body" style={{ color: colors.destructiveText, fontWeight: '600' }}>
              {t('cattle.workspace.overview.openCases', { count: format.numberSafe(openCasesCount) })}
            </Text>
          ) : null}

          {/* Active Withdrawal Alerts */}
          {withdrawals.map((w) => (
            <View
              key={w.id}
              testID={`withdrawal-alert-${w.kind}`}
              style={{
                padding: 10,
                borderRadius: radius.md,
                backgroundColor: colors.warningTint,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text role="caption" style={{ color: colors.warningText, fontWeight: '600' }}>
                {t('cattle.workspace.overview.activeWithdrawal', {
                  kind: w.kind === 'milk' ? t('cattle.workspace.tabs.feeding') : t('cattle.detail.section.basics'),
                  days: format.numberSafe(w.daysLeft),
                  date: format.dateSafe(Date.parse(w.until)),
                })}
              </Text>
            </View>
          ))}

          {/* Predictable healthy all-clear status row */}
          {openCasesCount === 0 && withdrawals.length === 0 ? (
            <View
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.md,
                backgroundColor: colors.muted,
              }}
            >
              <CheckCircleIcon size={18} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text role="caption" style={{ fontWeight: '600', color: colors.foreground }}>
                  {t('cattle.workspace.overview.allClear')}
                </Text>
                <Text role="caption" style={{ color: colors.mutedForeground, fontSize: 11 }}>
                  {t('cattle.workspace.overview.noActiveCases')}
                </Text>
              </View>
            </View>
          ) : null}

          <Button
            variant="secondary"
            size="md"
            label={t('cattle.workspace.overview.reportSickness')}
            onPress={() => onRecordEvent('ILLNESS')}
            testID="btn-report-sickness"
          />
        </View>
      </Card>

      {/* 4. Growth & Weight Card */}
      <Card testID="card-growth" style={{ minHeight: 145 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ScaleIcon size={18} color={colors.accentTeal} />
              <Text role="title" style={{ fontWeight: '700' }}>
                {t('cattle.workspace.overview.growthTitle')}
              </Text>
            </View>
            <Button
              variant="secondary"
              size="md"
              label={t('cattle.workspace.overview.weigh')}
              onPress={() => onRecordEvent('WEIGHT')}
              testID="btn-weigh"
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
            <View style={{ flex: 1 }}>
              <Text role="caption" style={{ color: colors.mutedForeground }}>
                {t('cattle.workspace.overview.weight')}
              </Text>
              <Text role="h2" style={{ fontWeight: '700', marginTop: 2 }}>
                {lastWeightVal != null ? `${format.numberSafe(lastWeightVal)} ${t('cattle.unit.kg')}` : '—'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text role="caption" style={{ color: colors.mutedForeground }}>
                {t('cattle.workspace.overview.weightChange')}
              </Text>
              <Text role="h2" style={{ fontWeight: '700', marginTop: 2 }}>
                {weightData.delta30 != null
                  ? `${weightData.delta30 > 0 ? '+' : ''}${format.numberSafe(weightData.delta30)} ${t('cattle.unit.kg')}`
                  : '—'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text role="caption" style={{ color: colors.mutedForeground }}>
                {t('cattle.workspace.overview.bcs')}
              </Text>
              <Text role="h2" style={{ fontWeight: '700', marginTop: 2 }}>
                {bcsVal != null ? format.numberSafe(bcsVal, { fractionDigits: 1 }) : '—'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* 5. Recent Events Card */}
      <Card testID="card-recent-events" style={{ height: 345 }}>
        <View
          style={{ flex: 1, gap: 10 }}
          onTouchStart={recentEvents.length > 0 ? handleScrollTouchStart : undefined}
          onTouchEnd={recentEvents.length > 0 ? handleScrollTouchEnd : undefined}
          onTouchCancel={recentEvents.length > 0 ? handleScrollTouchEnd : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: 8,
            }}
          >
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.overview.recentTitle')}
            </Text>
            {recentEvents.length > 0 ? (
              <Button
                variant="ghost"
                size="md"
                label={t('cattle.workspace.overview.seeAll')}
                onPress={onSeeAllTimeline}
                testID="btn-see-all-events"
              />
            ) : null}
          </View>

          {recentEvents.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: colors.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SparklesIcon size={18} color={colors.mutedForeground} />
              </View>
              <Text role="body" style={{ color: colors.foreground, fontWeight: '600' }}>
                {t('cattle.workspace.overview.noEvents')}
              </Text>
              <Text role="caption" style={{ color: colors.mutedForeground }}>
                {t('cattle.workspace.overview.noEventsHint')}
              </Text>
            </View>
          ) : (
            <ScrollView
              nestedScrollEnabled
              overScrollMode="never"
              bounces={false}
              showsVerticalScrollIndicator
              onTouchStart={handleScrollTouchStart}
              onTouchEnd={handleScrollTouchEnd}
              onTouchCancel={handleScrollTouchEnd}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollBegin={handleMomentumScrollBegin}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {recentEvents.map((event) => (
                <View
                  key={event.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radius.full,
                      backgroundColor: colors.muted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <EventKindIcon kind={event.type} size={16} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text role="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                      {event.title || event.type}
                    </Text>
                    <Text role="caption" style={{ color: colors.mutedForeground }}>
                      {format.dateTimeSafe(Date.parse(event.eventAt))}
                    </Text>
                  </View>
                  {event.recordedByName ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: radius.sm,
                        backgroundColor: colors.muted,
                      }}
                    >
                      <Text role="caption" style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        {event.recordedByName}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Card>

      {/* 6. Next Up Reminders Card */}
      <Card testID="card-next-up" style={{ height: 540 }}>
        <View
          style={{ flex: 1, gap: 10 }}
          onTouchStart={upcomingReminders.length > 0 ? handleScrollTouchStart : undefined}
          onTouchEnd={upcomingReminders.length > 0 ? handleScrollTouchEnd : undefined}
          onTouchCancel={upcomingReminders.length > 0 ? handleScrollTouchEnd : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingBottom: 8,
            }}
          >
            <CalendarClockIcon size={18} color={colors.warningText} />
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.overview.nextUpTitle')}
            </Text>
          </View>

          {upcomingReminders.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: colors.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarClockIcon size={18} color={colors.mutedForeground} />
              </View>
              <Text role="body" style={{ color: colors.foreground, fontWeight: '600' }}>
                {t('cattle.workspace.overview.noReminders')}
              </Text>
              <Text role="caption" style={{ color: colors.mutedForeground }}>
                {t('cattle.workspace.overview.noRemindersHint')}
              </Text>
            </View>
          ) : (
            <ScrollView
              nestedScrollEnabled
              overScrollMode="never"
              bounces={false}
              showsVerticalScrollIndicator
              onTouchStart={handleScrollTouchStart}
              onTouchEnd={handleScrollTouchEnd}
              onTouchCancel={handleScrollTouchEnd}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollBegin={handleMomentumScrollBegin}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            >
              {upcomingReminders.map((rem, idx) => (
                <View
                  key={rem.id || `rem-${idx}`}
                  style={{
                    padding: 12,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text role="body" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                      {rem.title}
                    </Text>
                    <Text role="caption" style={{ color: colors.warningText, fontWeight: '600' }}>
                      {t('cattle.workspace.stats.daysAgo', { days: format.numberSafe(rem.daysUntil) })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text role="caption" style={{ color: colors.mutedForeground, flex: 1 }}>
                      {rem.dueAt ? format.dateSafe(Date.parse(rem.dueAt)) : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Button
                      variant="secondary"
                      size="md"
                      label={t('cattle.workspace.overview.snooze')}
                      onPress={() => {}}
                    />
                    <Button
                      variant="secondary"
                      size="md"
                      label={t('cattle.workspace.overview.skip')}
                      onPress={() => {}}
                    />
                    <Button
                      variant="primary"
                      size="md"
                      label={t('cattle.workspace.overview.record')}
                      onPress={() => onRecordEvent(rem.kind)}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Card>

      {/* 7. At a Glance Card */}
      <Card testID="card-at-a-glance">
        <View style={{ gap: 10 }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
            <Text role="title" style={{ fontWeight: '700' }}>
              {t('cattle.workspace.overview.glanceTitle')}
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            {lactationText ? (
              <GlanceRow
                label={t('cattle.workspace.overview.glance.lactationStage')}
                value={lactationText}
                colors={colors}
              />
            ) : null}
            <GlanceRow
              label={t('cattle.workspace.overview.glance.lactation')}
              value={detail.reproduction?.currentLactation ? format.numberSafe(detail.reproduction.currentLactation) : '—'}
              colors={colors}
            />
            {reproText ? (
              <GlanceRow
                label={t('cattle.workspace.overview.glance.reproduction')}
                value={reproText}
                colors={colors}
              />
            ) : null}
            <GlanceRow
              label={t('cattle.workspace.overview.glance.breed')}
              value={detail.breedName ?? '—'}
              colors={colors}
            />
            <GlanceRow
              label={t('cattle.workspace.overview.glance.shed')}
              value={detail.shedName ?? '—'}
              colors={colors}
            />
            <GlanceRow
              label={t('cattle.workspace.overview.glance.source')}
              value={detail.sourceType ?? '—'}
              colors={colors}
            />
            <GlanceRow
              label={t('cattle.workspace.overview.glance.dob')}
              value={detail.dateOfBirth ? format.dateSafe(Date.parse(detail.dateOfBirth)) : '—'}
              colors={colors}
              isLast
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

function GlanceRow({
  label,
  value,
  colors,
  isLast = false,
}: {
  label: string;
  value: string;
  colors: ColorTokens;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text role="body" style={{ color: colors.mutedForeground }}>
        {label}
      </Text>
      <Text role="body" style={{ fontWeight: '600' }}>
        {value}
      </Text>
    </View>
  );
}
