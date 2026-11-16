/**
 * Session configuration sheet (WP10 UI/UX overhaul).
 * Allows farms to configure active milking sessions (e.g. 2-session farms locking Noon & Night).
 * Farms can lock sessions they do not use so workers focus only on their farm's milking routine.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { StatusBadge } from '../components/display/StatusBadge.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import {
  DEFAULT_SESSIONS,
  SESSION_ACCENTS,
  SESSION_LABEL_KEYS,
  type MilkSession,
} from './milk-model.ts';

export interface SessionConfigSheetProps {
  visible: boolean;
  onClose: () => void;
  configuredSessions: readonly MilkSession[];
  onSave: (sessions: MilkSession[]) => void;
  testID?: string;
}

export function SessionConfigSheet({
  visible,
  onClose,
  configuredSessions,
  onSave,
  testID = 'session-config-sheet',
}: SessionConfigSheetProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();

  const [selectedSessions, setSelectedSessions] = useState<MilkSession[]>(() => [...configuredSessions]);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedSessions([...configuredSessions]);
      setErrorNotice(null);
    }
  }, [visible, configuredSessions]);

  const toggleSession = (s: MilkSession) => {
    setErrorNotice(null);
    const isCurrentlyActive = selectedSessions.includes(s);

    if (isCurrentlyActive) {
      // Must keep at least one session active
      if (selectedSessions.length <= 1) {
        setErrorNotice(t('milk.sessionMinOne'));
        return;
      }
      setSelectedSessions(selectedSessions.filter((x) => x !== s));
    } else {
      // Add session maintaining canonical order
      const next = DEFAULT_SESSIONS.filter((item) => item === s || selectedSessions.includes(item));
      setSelectedSessions(next);
    }
  };

  const handleSave = () => {
    if (selectedSessions.length === 0) {
      setErrorNotice(t('milk.sessionMinOne'));
      return;
    }
    onSave(selectedSessions);
    onClose();
  };

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: tokens.spacing.xs,
        }}
      >
        <SheetTitle>{t('milk.manageSessions')}</SheetTitle>
        <IconButton
          icon="close"
          accessibilityLabel={t('picker.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID="session-config-close"
        />
      </View>

      <Text role="caption" color="mutedForeground" style={{ marginBottom: tokens.spacing.md }}>
        {t('milk.manageSessionsDesc')}
      </Text>

      {/* Error / Validation Banner */}
      {errorNotice ? (
        <View
          testID="session-config-error"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: tokens.spacing.xs,
            padding: tokens.spacing.sm,
            borderRadius: tokens.radius.md,
            backgroundColor: colors.destructiveTint,
            marginBottom: tokens.spacing.sm,
          }}
        >
          <Glyph name="exclamation" size={16} color="destructive" />
          <Text role="caption" color="destructiveText">
            {errorNotice}
          </Text>
        </View>
      ) : null}

      {/* Session Rows */}
      <View style={{ gap: tokens.spacing.sm }}>
        {DEFAULT_SESSIONS.map((s) => {
          const isActive = selectedSessions.includes(s);
          const accentColorKey = SESSION_ACCENTS[s];
          const accentColor = colors[accentColorKey] ?? colors.primary;

          return (
            <PressableSurface
              key={s}
              accessibilityRole="checkbox"
              accessibilityLabel={`${t(SESSION_LABEL_KEYS[s])} ${isActive ? 'active' : 'locked'}`}
              accessibilityState={{ checked: isActive }}
              pressedStyle="overlay"
              onPress={() => toggleSession(s)}
              testID={`session-toggle-${s.toLowerCase()}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: tokens.spacing.md,
                paddingHorizontal: tokens.spacing.md,
                borderRadius: tokens.radius.lg,
                borderWidth: 1,
                borderColor: isActive ? colors.primaryEdge : colors.border,
                backgroundColor: colors.card,
                minHeight: tokens.touchTarget.min,
              }}
            >
              {/* Left: Indicator Dot & Name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: tokens.radius.full,
                    backgroundColor: isActive ? accentColor : colors.mutedForeground,
                  }}
                />
                <Text role="label" color={isActive ? 'foreground' : 'mutedForeground'}>
                  {t(SESSION_LABEL_KEYS[s])}
                </Text>
              </View>

              {/* Right: Status / Lock Indicator */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
                {isActive ? (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: tokens.radius.full,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Glyph name="check" size={16} color="primaryForeground" />
                  </View>
                ) : (
                  <StatusBadge tone="neutral" label={t('milk.sessionLocked')} />
                )}
              </View>
            </PressableSurface>
          );
        })}
      </View>

      {/* Actions */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          marginTop: tokens.spacing.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            label={t('picker.cancel')}
            variant="secondary"
            size="md"
            onPress={onClose}
            testID="session-config-cancel"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t('milk.saveSessions')}
            variant="primary"
            size="md"
            onPress={handleSave}
            testID="session-config-save"
          />
        </View>
      </View>
    </SheetModal>
  );
}
