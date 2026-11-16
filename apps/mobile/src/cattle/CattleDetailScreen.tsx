/**
 * Animal detail (WP9, read only). Route `app/cattle/[id].tsx`. Same `cattle.read` gate as the tab. Shows what the live
 * profile and overview return; offline it shows the cached row with a notice and "last updated". No write actions.
 */
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/actions/Button.tsx';
import { Card } from '../components/display/Card.tsx';
import { SkeletonList } from '../components/display/Skeleton.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { EmptyState, ErrorState } from '../components/feedback/StateMessage.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { TABS } from '../navigation/nav-config.ts';
import { PermissionGate } from '../permissions/PermissionGate.tsx';
import type { CattleDetail } from './cattle-detail-model.ts';
import {
  categoryKey,
  cattleTitle,
  genderKey,
  healthBadge,
  humanize,
  productionBadge,
  reproBadge,
  primaryBadge,
  type BadgeSpec,
} from './cattle-model.ts';
import { useCattleDetail } from './useCattleDetail.ts';

const CATTLE_PERMISSION = TABS.find((tab) => tab.key === 'cattle')?.permission ?? 'cattle.read';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

function Badge({ spec, t }: { spec: BadgeSpec; t: Translate }) {
  const label = spec.labelKey ? t(spec.labelKey) : humanize(spec.raw ?? '');
  return 'herdState' in spec ? (
    <StatusBadge herdState={spec.herdState} label={label} />
  ) : (
    <StatusBadge tone={spec.tone} label={label} />
  );
}

function Field({ label, children, testID }: { label: string; children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={{ gap: 2, paddingVertical: 6 }}>
      <Text role="label" color="mutedForeground">
        {label}
      </Text>
      {typeof children === 'string' ? <Text role="body">{children}</Text> : children}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text role="title">{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

function Notice({ text, testID }: { text: string; testID: string }) {
  return (
    <Card testID={testID}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Glyph name="info" size={20} color="infoText" />
        <Text role="body" style={{ flex: 1 }}>
          {text}
        </Text>
      </View>
    </Card>
  );
}

function DetailBody({ detail, t }: { detail: CattleDetail; t: Translate }) {
  const format = useFormat();
  const category = categoryKey(detail.animalCategory);
  const gender = genderKey(detail.gender);
  const production = productionBadge(detail.productionStatus);
  const health = healthBadge(detail.healthStatus);
  const repro = reproBadge(detail.reproductiveStatus);
  const left = detail.herdStatus && detail.herdStatus !== 'ACTIVE' ? primaryBadge(detail) : null;
  const hasMilk = detail.avgDailyYield7d !== null || detail.lastWeightKg !== null || detail.aqrScore !== null;
  const hasFamily = detail.motherLabel !== null || detail.fatherLabel !== null || detail.childrenCount !== null;

  return (
    <>
      <Section title={t('cattle.detail.section.basics')}>
        <Field label={t('cattle.detail.tag')} testID="detail-tag">
          {detail.tagNumber || '—'}
        </Field>
        {detail.name ? <Field label={t('cattle.detail.name')}>{detail.name}</Field> : null}
        {detail.breedName ? <Field label={t('cattle.detail.breed')}>{detail.breedName}</Field> : null}
        {gender ? <Field label={t('cattle.detail.gender')}>{t(gender)}</Field> : null}
        {category ? <Field label={t('cattle.detail.category')}>{t(category)}</Field> : null}
        {detail.dateOfBirth ? (
          <Field label={t('cattle.detail.birthDate')}>{format.dateSafe(Date.parse(detail.dateOfBirth))}</Field>
        ) : null}
        {detail.age ? (
          <Field label={t('cattle.detail.age')}>
            {t('cattle.age', { years: format.numberSafe(detail.age.years), months: format.numberSafe(detail.age.months) })}
          </Field>
        ) : null}
        {detail.shedName ? <Field label={t('cattle.detail.shed')}>{detail.shedName}</Field> : null}
      </Section>

      {left || production || health || repro ? (
      <Section title={t('cattle.detail.section.status')}>
        {left ? (
          <Field label={t('cattle.detail.herdStatus')}>
            <Badge spec={left} t={t} />
          </Field>
        ) : null}
        {production ? (
          <Field label={t('cattle.detail.production')}>
            <Badge spec={production} t={t} />
          </Field>
        ) : null}
        {health ? (
          <Field label={t('cattle.detail.health')}>
            <Badge spec={health} t={t} />
          </Field>
        ) : null}
        {repro ? (
          <Field label={t('cattle.detail.reproduction')}>
            <Badge spec={repro} t={t} />
          </Field>
        ) : null}
      </Section>
      ) : null}

      {hasMilk ? (
        <Section title={t('cattle.detail.section.milk')}>
          {detail.avgDailyYield7d !== null ? (
            <Field label={t('cattle.detail.yield7d')} testID="detail-yield">
              {`${format.numberSafe(detail.avgDailyYield7d, { fractionDigits: 1 })} ${t('cattle.unit.litre')}`}
            </Field>
          ) : null}
          {detail.lastWeightKg !== null ? (
            <Field label={t('cattle.detail.lastWeight')}>
              {`${format.numberSafe(detail.lastWeightKg, { fractionDigits: 0 })} ${t('cattle.unit.kg')}`}
            </Field>
          ) : null}
          {detail.aqrScore !== null ? (
            <Field label={t('cattle.detail.aqr')}>{format.numberSafe(detail.aqrScore, { fractionDigits: 0 })}</Field>
          ) : null}
        </Section>
      ) : null}

      {hasFamily ? (
        <Section title={t('cattle.detail.section.family')}>
          {detail.motherLabel ? <Field label={t('cattle.detail.mother')}>{detail.motherLabel}</Field> : null}
          {detail.fatherLabel ? <Field label={t('cattle.detail.father')}>{detail.fatherLabel}</Field> : null}
          {detail.childrenCount !== null ? (
            <Field label={t('cattle.detail.calves')}>{format.numberSafe(detail.childrenCount)}</Field>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function DetailContent({ id }: { id: string }) {
  const { t } = useLocale();
  const format = useFormat();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, lastSyncedAt, reload } = useCattleDetail(id);

  const time = lastSyncedAt === null ? '—' : format.dateTimeSafe(lastSyncedAt);
  const title = state.phase === 'ready' ? cattleTitle(state.detail) || t('cattle.detail.title') : t('cattle.detail.title');

  let body: ReactNode;
  if (state.phase === 'loading') {
    body = <SkeletonList rows={5} variant="card" />;
  } else if (state.phase === 'notFound') {
    body = (
      <EmptyState
        testID="detail-not-found"
        title={t('cattle.detail.notFound.title')}
        description={t('cattle.detail.notFound.message')}
      />
    );
  } else if (state.phase === 'error') {
    body = <ErrorState testID="detail-error" onRetry={reload} />;
  } else {
    body = (
      <View style={{ gap: 16 }}>
        {state.notice === 'offline' ? (
          <Notice testID="detail-offline" text={t('cattle.detail.offlineNotice', { time })} />
        ) : null}
        {state.notice === 'failed' ? (
          <Notice testID="detail-failed" text={t('cattle.detail.failedNotice', { time })} />
        ) : null}
        <DetailBody detail={state.detail} t={t} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="screen-cattle-detail">
      <View
        style={{
          gap: 4,
          paddingTop: insets.top + 4,
          paddingBottom: 8,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label={t('common.back')}
            variant="ghost"
            fullWidth={false}
            testID="detail-back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/cattle'))}
          />
        </View>
        <Text role="h2" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {body}
      </ScrollView>
    </View>
  );
}

export function CattleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <PermissionGate permission={CATTLE_PERMISSION}>
      <DetailContent id={Array.isArray(id) ? (id[0] ?? '') : (id ?? '')} />
    </PermissionGate>
  );
}
