import { memo, useCallback, useState } from 'react';
import { View } from 'react-native';
import { IconButton } from '../components/actions/IconButton.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import type { MessageKey } from '../i18n/messages.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { InboxTab } from './InboxTab.tsx';
import { NewTab } from './NewTab.tsx';
import { ArrowLeftIcon, SettingsSlidersIcon } from './notification-icons.tsx';
import { NotificationPreferencesView } from './NotificationPreferencesView.tsx';
import { UpcomingTab } from './UpcomingTab.tsx';

export type NotificationTabKey = 'inbox' | 'upcoming' | 'new';

const TAB_LABELS: Record<NotificationTabKey, MessageKey> = {
  inbox: 'notif.tabs.inbox',
  upcoming: 'notif.tabs.upcoming',
  new: 'notif.tabs.new',
};

export interface NotificationSheetProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: NotificationTabKey;
  testID?: string;
}

export const NotificationSheet = memo(function NotificationSheet({
  visible,
  onClose,
  initialTab = 'inbox',
  testID = 'notification-sheet',
}: NotificationSheetProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<NotificationTabKey>(initialTab);
  const [view, setView] = useState<'tabs' | 'preferences'>('tabs');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const handleEditSchedule = useCallback((scheduleId: string) => {
    setEditingScheduleId(scheduleId);
    setActiveTab('new');
    setView('tabs');
  }, []);

  const handleDoneOrCancelNew = useCallback(() => {
    setEditingScheduleId(null);
    setActiveTab('upcoming');
  }, []);

  const handleClose = useCallback(() => {
    setView('tabs');
    setEditingScheduleId(null);
    onClose();
  }, [onClose]);

  return (
    <SheetModal
      visible={visible}
      onRequestClose={handleClose}
      testID={testID}
      scrollable={false}
      heightFraction={0.78}
    >
      {/* 1. Header (Always fixed at top) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: tokens.spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, flex: 1 }}>
          {view === 'preferences' ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('notif.back')}
              pressedStyle="overlay"
              onPress={() => setView('tabs')}
              testID="notif-back-btn"
              style={{
                width: 36,
                height: 36,
                borderRadius: tokens.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeftIcon size={18} color={colors.foreground} />
            </PressableSurface>
          ) : null}

          <SheetTitle>
            {view === 'preferences' ? t('notif.preferences') : t('notif.title')}
          </SheetTitle>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          {view === 'tabs' ? (
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('notif.preferences')}
              pressedStyle="overlay"
              onPress={() => setView('preferences')}
              testID="notif-settings-btn"
              style={{
                width: 40,
                height: 40,
                borderRadius: tokens.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <SettingsSlidersIcon size={18} color={colors.foreground} />
            </PressableSurface>
          ) : null}

          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={handleClose}
            testID="notif-sheet-close"
          />
        </View>
      </View>

      {/* 2. Content */}
      {view === 'preferences' ? (
        <View style={{ flex: 1 }}>
          <NotificationPreferencesView />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Segmented Tabs Control (Fixed below header) */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.muted,
              borderRadius: tokens.radius.md,
              padding: 2,
              marginVertical: tokens.spacing.xs,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {(['inbox', 'upcoming', 'new'] as const).map((tabKey) => {
              const active = activeTab === tabKey;
              return (
                <PressableSurface
                  key={tabKey}
                  accessibilityRole="tab"
                  accessibilityLabel={t(TAB_LABELS[tabKey])}
                  pressedStyle="overlay"
                  onPress={() => {
                    if (tabKey !== 'new') setEditingScheduleId(null);
                    setActiveTab(tabKey);
                  }}
                  testID={`notif-tab-${tabKey}`}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: tokens.radius.md - 2,
                    backgroundColor: active ? colors.card : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 36,
                  }}
                >
                  <Text
                    role="caption"
                    color={active ? 'primary' : 'mutedForeground'}
                    style={{ fontWeight: '700', fontSize: 13 }}
                  >
                    {t(TAB_LABELS[tabKey])}
                  </Text>
                </PressableSurface>
              );
            })}
          </View>

          {/* Active Tab Body (Scrollable inside flex: 1) */}
          <View style={{ flex: 1, marginTop: tokens.spacing.xs }}>
            {activeTab === 'inbox' ? (
              <InboxTab onNavigate={handleClose} />
            ) : activeTab === 'upcoming' ? (
              <UpcomingTab onEdit={handleEditSchedule} />
            ) : (
              <NewTab
                editingScheduleId={editingScheduleId}
                onDone={handleDoneOrCancelNew}
                onCancel={handleDoneOrCancelNew}
              />
            )}
          </View>
        </View>
      )}
    </SheetModal>
  );
});
