/**
 * OfflineDetailsSheet: Bottom sheet modal opened when the user taps the small offline icon.
 * Gives context without disrupting the main screen layout.
 * ADR-007 compliant (zero shadows, 1px border separation, system token colors).
 */
import { View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { WifiOffIcon } from './CattleIcons.tsx';

export interface OfflineDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  lastUpdatedText?: string | null;
  message?: string;
  testID?: string;
}

export function OfflineDetailsSheet({
  visible,
  onClose,
  lastUpdatedText,
  message,
  testID = 'offline-details-sheet',
}: OfflineDetailsSheetProps) {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID}>
      <View style={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.sm }}>
        {/* Header icon badge + Title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: tokens.radius.full,
              backgroundColor: colors.warningTint,
              borderWidth: 1,
              borderColor: colors.warningEdge,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WifiOffIcon size={18} color={colors.warningText} />
          </View>
          <View style={{ flex: 1 }}>
            <SheetTitle>{t('sync.pill.offline')}</SheetTitle>
          </View>
        </View>

        {/* Explanation Message */}
        <Text role="body" color="foreground" style={{ lineHeight: 22 }}>
          {message ?? t('cattle.offline')}
        </Text>

        {lastUpdatedText ? (
          <View
            style={{
              backgroundColor: colors.muted,
              borderRadius: tokens.radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
            }}
          >
            <Text role="caption" color="mutedForeground">
              {lastUpdatedText}
            </Text>
          </View>
        ) : null}

        {/* Action button */}
        <View style={{ paddingTop: tokens.spacing.xs }}>
          <Button
            label={t('common.close')}
            variant="secondary"
            size="md"
            fullWidth
            onPress={onClose}
            testID="offline-sheet-close-btn"
          />
        </View>
      </View>
    </SheetModal>
  );
}
