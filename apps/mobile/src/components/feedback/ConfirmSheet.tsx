/**
 * ConfirmSheet (spec 2.12): a bottom-sheet confirmation for IRREVERSIBLE actions only (archive / soft-delete uses a
 * Toast undo instead). Built on SheetModal.
 *
 * - Title (screen-reader focus target on open), optional message, then a column: confirm Button (lg; `primary` or
 *   `destructive`) FIRST, cancel Button (secondary, lg) LAST, 12dp apart. The confirm label is a verb, never "OK".
 * - Android back and backdrop tap call `onCancel`, except while `loading`: then the confirm button is busy, cancel is
 *   disabled and the sheet cannot be dismissed. No error state: a failure surfaces as a Toast or screen error.
 * Callers pass already-translated strings; `cancelLabel` defaults to `t('common.cancel')`.
 */
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { spacing } from '../../theme/tokens.ts';
import { View } from 'react-native';
import { Button } from '../actions/Button.tsx';
import { SheetModal, SheetTitle } from '../internal/SheetModal.tsx';
import { Text } from '../primitives/Text.tsx';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** A verb ("Delete"), never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  /** Confirm is busy; both buttons are inert and the sheet cannot be dismissed. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { t } = useLocale();

  return (
    <SheetModal visible={visible} onRequestClose={onCancel} dismissable={!loading} testID="confirm-sheet">
      <SheetTitle>{title}</SheetTitle>
      {message !== undefined && message !== '' ? (
        <Text role="body" color="mutedForeground">
          {message}
        </Text>
      ) : null}
      <View style={{ gap: spacing.md }}>
        <Button
          testID="confirm-sheet-confirm"
          label={confirmLabel}
          onPress={onConfirm}
          variant={tone === 'destructive' ? 'destructive' : 'primary'}
          size="lg"
          loading={loading}
        />
        <Button
          testID="confirm-sheet-cancel"
          label={cancelLabel ?? t('common.cancel')}
          onPress={onCancel}
          variant="secondary"
          size="lg"
          disabled={loading}
        />
      </View>
    </SheetModal>
  );
}
