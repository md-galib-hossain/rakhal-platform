import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Switch, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { TelegramIcon } from './notification-icons.tsx';
import type { NotificationChannels } from './notification-types.ts';
import { useNotifications } from './useNotifications.ts';

interface NotificationPreferencesViewProps {
  testID?: string;
}

export const NotificationPreferencesView = memo(function NotificationPreferencesView({
  testID = 'notification-preferences-view',
}: NotificationPreferencesViewProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const { client } = useAuth();
  const { loadPreferences, updatePreferences } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<NotificationChannels>({
    in_app: true,
    push: true,
    sms: false,
    whatsapp: false,
    telegram: false,
    email: false,
  });

  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('06:00');

  const [telegramLinked, setTelegramLinked] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const prefs = await loadPreferences();
      if (prefs) {
        if (prefs.quiet_hours.start && prefs.quiet_hours.end) {
          setQuietHoursEnabled(true);
          setQuietStart(prefs.quiet_hours.start);
          setQuietEnd(prefs.quiet_hours.end);
        }
        if (prefs.preferences.length > 0) {
          const first = prefs.preferences[0];
          setChannels(first.channels);
        }
      }
      try {
        const tg = await client.get<{ linked?: boolean }>('/notifications/telegram/status');
        setTelegramLinked(Boolean(tg.data?.linked));
      } catch {
        // ignore
      }
      setLoading(false);
    })();
  }, [loadPreferences, client]);

  const handleToggleChannel = useCallback((key: keyof NotificationChannels, val: boolean) => {
    setChannels((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updatePreferences({
        quiet_hours: quietHoursEnabled ? { start: quietStart, end: quietEnd } : { start: null, end: null },
      });
      Alert.alert('', t('common.save'));
    } catch {
      Alert.alert('', t('common.error.generic'));
    } finally {
      setSaving(false);
    }
  }, [quietHoursEnabled, quietStart, quietEnd, updatePreferences, t]);

  const handleTelegramAction = useCallback(async () => {
    if (telegramLinked) {
      try {
        await client.delete('/notifications/telegram/link');
        setTelegramLinked(false);
        Alert.alert('', t('notif.pref.telegramDisconnect'));
      } catch {
        // ignore
      }
    } else {
      try {
        const res = await client.get<{ deepLink?: string }>('/notifications/telegram/link-token');
        if (res.data?.deepLink) {
          void Linking.openURL(res.data.deepLink);
        }
      } catch {
        Alert.alert('', t('common.error.generic'));
      }
    }
  }, [telegramLinked, client, t]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }} testID={testID}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: tokens.spacing.lg, paddingVertical: tokens.spacing.sm, paddingBottom: 60 }}
      testID={testID}
    >
      {/* 1. Delivery Channels */}
      <View style={{ gap: tokens.spacing.sm }}>
        <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
          {t('notif.pref.channelsTitle')}
        </Text>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: tokens.spacing.md,
          }}
        >
          {(
            [
              ['in_app', t('notif.pref.inApp')],
              ['push', t('notif.pref.push')],
              ['sms', t('notif.pref.sms')],
              ['whatsapp', t('notif.pref.whatsapp')],
              ['telegram', t('notif.pref.telegram')],
              ['email', t('notif.pref.email')],
            ] as const
          ).map(([key, label], idx) => (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: tokens.spacing.sm,
                borderTopWidth: idx > 0 ? 1 : 0,
                borderTopColor: colors.border,
                minHeight: 48,
              }}
            >
              <Text role="body" color="foreground" style={{ fontWeight: '600' }}>
                {label}
              </Text>
              <Switch
                value={channels[key]}
                onValueChange={(val) => handleToggleChannel(key, val)}
                thumbColor={colors.card}
                trackColor={{ false: colors.muted, true: colors.primary }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* 2. Quiet Hours */}
      <View style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
              {t('notif.pref.quietHoursTitle')}
            </Text>
            <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
              {t('notif.pref.quietHoursDesc')}
            </Text>
          </View>
          <Switch
            value={quietHoursEnabled}
            onValueChange={setQuietHoursEnabled}
            thumbColor={colors.card}
            trackColor={{ false: colors.muted, true: colors.primary }}
          />
        </View>

        {quietHoursEnabled ? (
          <View
            style={{
              flexDirection: 'row',
              gap: tokens.spacing.md,
              backgroundColor: colors.card,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: tokens.spacing.md,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '600' }}>
                Start Time
              </Text>
              <TextInput
                value={quietStart}
                onChangeText={setQuietStart}
                placeholder="22:00"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.sm,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  color: colors.foreground,
                }}
              />
            </View>

            <View style={{ flex: 1, gap: 4 }}>
              <Text role="caption" color="mutedForeground" style={{ fontWeight: '600' }}>
                End Time
              </Text>
              <TextInput
                value={quietEnd}
                onChangeText={setQuietEnd}
                placeholder="06:00"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.sm,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  color: colors.foreground,
                }}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* 3. Telegram Bot Integration */}
      <View style={{ gap: tokens.spacing.sm }}>
        <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 16 }}>
          {t('notif.pref.telegramTitle')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.card,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: tokens.spacing.md,
            minHeight: 60,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
            <TelegramIcon size={24} color={colors.primary} />
            <Text role="body" color="foreground" style={{ fontWeight: '600' }}>
              {telegramLinked ? t('notif.pref.telegramConnected') : t('notif.pref.telegramNotConnected')}
            </Text>
          </View>

          <Button
            label={telegramLinked ? t('notif.pref.telegramDisconnect') : t('notif.pref.telegramConnect')}
            variant={telegramLinked ? 'secondary' : 'primary'}
            size="md"
            onPress={handleTelegramAction}
          />
        </View>
      </View>

      {/* Save Button */}
      <View style={{ paddingTop: tokens.spacing.sm }}>
        <Button
          label={saving ? t('notif.new.submitting') : t('common.save')}
          variant="primary"
          size="lg"
          onPress={handleSave}
          disabled={saving}
        />
      </View>
    </ScrollView>
  );
});
