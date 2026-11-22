/**
 * TimelineTab: Tab 2 of the Animal Workspace.
 * Full event history with category filter chips (All, Repro, Health, Growth, Moves, Notes),
 * "Show voided" toggle, and chronological date-grouped event list.
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import { Card } from '../../components/display/Card.tsx';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useFormat } from '../../i18n/useFormat.ts';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';
import { EventKindIcon } from '../CattleIcons.tsx';

export interface TimelineTabProps {
  detail: CattleDetail;
  testID?: string;
}

type FilterGroup = 'ALL' | 'REPRODUCTION' | 'HEALTH' | 'GROWTH' | 'MOVEMENT' | 'OTHER';

export function TimelineTab({ detail, testID = 'tab-timeline' }: TimelineTabProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const format = useFormat();

  const [activeGroup, setActiveGroup] = useState<FilterGroup>('ALL');
  const [showVoided, setShowVoided] = useState(false);

  const filters: { key: FilterGroup; label: string }[] = [
    { key: 'ALL', label: t('cattle.workspace.timeline.filterAll') },
    { key: 'REPRODUCTION', label: t('cattle.workspace.timeline.filterRepro') },
    { key: 'HEALTH', label: t('cattle.workspace.timeline.filterHealth') },
    { key: 'GROWTH', label: t('cattle.workspace.timeline.filterGrowth') },
    { key: 'MOVEMENT', label: t('cattle.workspace.timeline.filterMoves') },
    { key: 'OTHER', label: t('cattle.workspace.timeline.filterNotes') },
  ];

  const filteredEvents = useMemo(() => {
    const list = detail.timelineEvents ?? [];
    return list.filter((ev) => {
      if (!showVoided && ev.status === 'VOIDED') return false;
      if (activeGroup === 'ALL') return true;
      return ev.group === activeGroup;
    });
  }, [detail.timelineEvents, activeGroup, showVoided]);

  return (
    <View testID={testID} style={{ gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
      {/* Filters row & Show voided switch */}
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {filters.map((f) => {
            const isSelected = activeGroup === f.key;
            return (
              <PressableSurface
                key={f.key}
                accessibilityRole="button"
                pressedStyle="overlay"
                testID={`filter-${f.key.toLowerCase()}`}
                onPress={() => setActiveGroup(f.key)}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 14,
                  borderRadius: radius.full,
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  role="body"
                  style={{
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {f.label}
                </Text>
              </PressableSurface>
            );
          })}
        </View>

        {/* Show voided toggle */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: 12,
          }}
        >
          <Text role="body" style={{ color: colors.mutedForeground }}>
            {t('cattle.workspace.timeline.showVoided')}
          </Text>
          <Switch
            testID="switch-show-voided"
            value={showVoided}
            onValueChange={setShowVoided}
            trackColor={{ false: colors.muted, true: colors.primary }}
          />
        </View>
      </View>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <Card>
          <View style={{ minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <EventKindIcon kind="NOTE" size={24} color={colors.mutedForeground} />
            <Text role="body" style={{ color: colors.mutedForeground }}>
              {t('cattle.workspace.timeline.empty')}
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {filteredEvents.map((event, idx) => {
            const isVoided = event.status === 'VOIDED';
            return (
              <Card key={event.id || `event-${idx}`} testID={`timeline-event-${event.id || idx}`}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', opacity: isVoided ? 0.6 : 1 }}>
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
                    <EventKindIcon kind={event.type} size={18} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text role="body" style={{ fontWeight: '700' }} numberOfLines={1}>
                        {event.title || event.type}
                      </Text>
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

                    {event.notes ? (
                      <Text role="body" style={{ color: colors.foreground }}>
                        {event.notes}
                      </Text>
                    ) : null}

                    <Text role="caption" style={{ color: colors.mutedForeground }}>
                      {format.dateTimeSafe(Date.parse(event.eventAt))}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
}
