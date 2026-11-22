/**
 * SingleDeleteModal: Confirmation bottom sheet for soft-deleting an animal.
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider.tsx';
import { Button } from '../../components/actions/Button.tsx';
import { TextField } from '../../components/forms/TextField.tsx';
import { SheetModal, SheetTitle } from '../../components/internal/SheetModal.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';

export interface SingleDeleteModalProps {
  visible: boolean;
  onClose: () => void;
  detail: CattleDetail;
  onSuccess: (message: string) => void;
  testID?: string;
}

export function SingleDeleteModal({
  visible,
  onClose,
  detail,
  onSuccess,
  testID = 'single-delete-modal',
}: SingleDeleteModalProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const { client } = useAuth();

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await client.delete(`/cattle/${encodeURIComponent(detail.id)}`, {
        body: { reason: 'archived', notes: notes.trim() || undefined },
      });
      onSuccess(t('cattle.workspace.deleteSuccess'));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete animal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SheetModal visible={visible} onRequestClose={onClose} heightFraction={0.55} testID={testID}>
      <View style={{ gap: 14 }}>
        <SheetTitle>{t('cattle.workspace.delete')}</SheetTitle>
        <Text role="body" style={{ color: colors.destructiveText, fontWeight: '600' }}>
          {t('cattle.workspace.deleteConfirm')}
        </Text>
        <Text role="caption" style={{ color: colors.mutedForeground }}>
          {detail.name || detail.tagNumber}
        </Text>

        {error ? (
          <View
            style={{
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: colors.destructiveTint,
              borderWidth: 1,
              borderColor: colors.destructive,
            }}
          >
            <Text role="body" style={{ color: colors.destructiveText }}>
              {error}
            </Text>
          </View>
        ) : null}

        <TextField
          label={t('cattle.detail.name')}
          value={notes}
          onChangeText={setNotes}
          testID="delete-notes-input"
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button
            variant="secondary"
            label={t('common.cancel')}
            onPress={onClose}
            disabled={submitting}
            testID="delete-btn-cancel"
          />
          <Button
            variant="destructive"
            label={t('cattle.workspace.delete')}
            onPress={handleDelete}
            loading={submitting}
            testID="delete-btn-submit"
          />
        </View>
      </View>
    </SheetModal>
  );
}
