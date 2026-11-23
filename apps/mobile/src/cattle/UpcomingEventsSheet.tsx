/**
 * UpcomingEventsSheet (WP9 & Redesign).
 * Bottom sheet modal displaying upcoming events for an animal.
 * Strictly ADR-007 compliant: 1px border, zero drop shadows, scrimColor backdrop.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import {
  eventKindMessageKey,
  formatNextEventDue,
  formatNextEventTitle,
  humanize,
  type CattleListItem,
  type CattleNextEvent,
} from './cattle-model.ts';
import { EventKindIcon } from './CattleIcons.tsx';

export interface UpcomingEventsSheetProps {
  item: CattleListItem | null;
  visible: boolean;
  onClose: () => void;
  onView: (item: CattleListItem) => void;
  testID?: string;
}

interface RawUpcomingEvent {
  kind?: unknown;
  title?: unknown;
  urgency?: unknown;
  actionable?: unknown;
  daysUntil?: unknown;
  dueAt?: unknown;
  labelKey?: unknown;
  labelParams?: Record<string, unknown> | null;
}

interface RawUpcomingEventsResponse {
  data?: {
    events?: RawUpcomingEvent[];
    total?: number;
  };
  events?: RawUpcomingEvent[];
  total?: number;
}

export function UpcomingEventsSheet({
  item,
  visible,
  onClose,
  onView,
  testID = 'upcoming-events-sheet',
}: UpcomingEventsSheetProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const { client } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [events, setEvents] = useState<CattleNextEvent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  const fetchEvents = useCallback(async (cowId: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await client.get<RawUpcomingEventsResponse>(`/cattle/${encodeURIComponent(cowId)}/upcoming-events`);
      const data = res?.data?.data ?? res?.data;
      if (data && Array.isArray(data.events)) {
        const mapped: CattleNextEvent[] = data.events.map((ev: RawUpcomingEvent) => ({
          kind: typeof ev.kind === 'string' ? ev.kind : 'TASK',
          title:
            typeof ev.labelParams?.title === 'string'
              ? ev.labelParams.title
              : typeof ev.title === 'string'
                ? ev.title
                : null,
          urgency: typeof ev.urgency === 'string' ? ev.urgency : null,
          actionable: ev.actionable !== false,
          daysUntil: typeof ev.daysUntil === 'number' ? ev.daysUntil : null,
          dueAt: typeof ev.dueAt === 'string' ? ev.dueAt : null,
          labelKey: typeof ev.labelKey === 'string' ? ev.labelKey : null,
          labelParams: ev.labelParams ?? null,
        }));
        setEvents(mapped);
        setTotalCount(typeof data.total === 'number' ? data.total : mapped.length);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (visible && item) {
      // Fallback: seed with cached nextEvent if available
      if (item.nextEvent) {
        setEvents([item.nextEvent]);
        setTotalCount(item.nextEvent.upcomingEventCount ?? 1);
      } else {
        setEvents([]);
        setTotalCount(0);
      }
      void fetchEvents(item.id);
    }
  }, [visible, item, fetchEvents]);

  if (!item) return null;

  const animalTitle = item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber;
  const countDisplay = totalCount > 0 ? totalCount : events.length;

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: tokens.spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              role="caption"
              color="mutedForeground"
              style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}
            >
              {t('cattle.upcoming.title')}
            </Text>
            {countDisplay > 0 ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                  borderRadius: tokens.radius.full,
                  backgroundColor: colors.successTint,
                  borderWidth: 1,
                  borderColor: colors.primaryEdge,
                }}
              >
                <Text role="caption" style={{ color: colors.primaryText, fontSize: 11, fontWeight: '700' }}>
                  {format.numberSafe(countDisplay)}
                </Text>
              </View>
            ) : null}
          </View>
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={`${animalTitle} ${t('cattle.detail.title')}`}
            pressedStyle="overlay"
            onPress={() => {
              onClose();
              onView(item);
            }}
            testID={`${testID}-animal-title-link`}
            style={{ borderRadius: tokens.radius.sm, alignSelf: 'flex-start' }}
          >
            <SheetTitle>{animalTitle}</SheetTitle>
          </PressableSurface>
        </View>

        <IconButton
          icon="close"
          accessibilityLabel={t('cattle.upcoming.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID={`${testID}-close-btn`}
        />
      </View>

      {/* Events List / Loading / Error */}
      <View style={{ gap: tokens.spacing.sm }}>
        {loading && events.length === 0 ? (
          <View style={{ paddingVertical: tokens.spacing.xl, alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text role="caption" color="mutedForeground">
              {t('cattle.upcoming.loading')}
            </Text>
          </View>
        ) : error && events.length === 0 ? (
          <View style={{ paddingVertical: tokens.spacing.lg, alignItems: 'center', gap: tokens.spacing.sm }}>
            <Text role="caption" color="destructive">
              {t('cattle.upcoming.error')}
            </Text>
            <Button
              label={t('cattle.upcoming.retry')}
              variant="secondary"
              size="md"
              onPress={() => void fetchEvents(item.id)}
            />
          </View>
        ) : events.length === 0 ? (
          <View style={{ paddingVertical: tokens.spacing.xl, alignItems: 'center' }}>
            <Text role="caption" color="mutedForeground">
              {t('cattle.upcoming.empty')}
            </Text>
          </View>
        ) : (
          events.map((ev, index) => {
            const evTitle = formatNextEventTitle(ev, t);
            const dueInfo = formatNextEventDue(ev.daysUntil, t, format.numberSafe);
            const urgency = dueInfo?.urgency ?? 'muted';
            const kindKey = eventKindMessageKey(ev.kind);
            const kindLabel = kindKey ? t(kindKey) : humanize(ev.kind);

            let dueFormattedDate: string | null = null;
            if (ev.dueAt) {
              const parsed = Date.parse(ev.dueAt);
              if (Number.isFinite(parsed)) {
                dueFormattedDate = format.dateSafe(new Date(parsed));
              }
            }

            const toneColors =
              urgency === 'destructive'
                ? {
                    border: colors.destructive,
                    bg: colors.destructiveTint,
                    text: colors.destructiveText,
                  }
                : urgency === 'warning'
                  ? {
                      border: colors.warning,
                      bg: colors.warningTint,
                      text: colors.warningText,
                    }
                  : urgency === 'info'
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

            return (
              <View
                key={`${ev.kind}-${ev.dueAt ?? ''}-${ev.title ?? ''}-${index}`}
                testID={`${testID}-item-${index}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: tokens.spacing.sm,
                  paddingVertical: tokens.spacing.xs,
                  borderBottomWidth: index < events.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                {/* Circular Icon Container */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: toneColors.border,
                    backgroundColor: toneColors.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  <EventKindIcon kind={ev.kind} size={16} color={toneColors.text} />
                </View>

                {/* Event Details */}
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Text
                      role="body"
                      color="foreground"
                      style={{ fontWeight: '700', fontSize: 14 }}
                      numberOfLines={2}
                    >
                      {evTitle}
                    </Text>
                    {ev.actionable === false ? (
                      <Text role="caption" color="mutedForeground" style={{ fontSize: 11 }}>
                        · {t('cattle.upcoming.info')}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    {dueInfo ? (
                      <Text
                        role="caption"
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: toneColors.text,
                        }}
                      >
                        {dueInfo.text}
                      </Text>
                    ) : null}
                    {dueFormattedDate ? (
                      <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                        ({dueFormattedDate})
                      </Text>
                    ) : null}
                    {kindLabel && kindLabel !== evTitle ? (
                      <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                        · {kindLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Bottom Button: View animal */}
      <View
        style={{
          paddingTop: tokens.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          label={t('cattle.upcoming.viewAnimal')}
          variant="secondary"
          size="lg"
          onPress={() => {
            onClose();
            onView(item);
          }}
          testID={`${testID}-view-animal-btn`}
        />
      </View>
    </SheetModal>
  );
}
