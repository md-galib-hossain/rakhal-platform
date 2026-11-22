/**
 * EditAnimalProfileModal: Quick sheet modal to edit animal profile details.
 * Edits name, tag number, and notes.
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

export interface EditAnimalProfileModalProps {
  visible: boolean;
  onClose: () => void;
  detail: CattleDetail;
  onSuccess: () => void;
  testID?: string;
}

export function EditAnimalProfileModal({
  visible,
  onClose,
  detail,
  onSuccess,
  testID = 'edit-animal-modal',
}: EditAnimalProfileModalProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const { client } = useAuth();

  const [name, setName] = useState(detail.name || '');
  const [tagNumber, setTagNumber] = useState(detail.tagNumber || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!tagNumber.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.patch(`/cattle/${encodeURIComponent(detail.id)}`, {
        name: name.trim() || undefined,
        tagNumber: tagNumber.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update animal profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SheetModal visible={visible} onRequestClose={onClose} heightFraction={0.65} testID={testID}>
      <View style={{ gap: 14 }}>
        <SheetTitle>{t('cattle.workspace.edit')}</SheetTitle>

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
          label={t('cattle.detail.tag')}
          value={tagNumber}
          onChangeText={setTagNumber}
          testID="edit-tag-input"
        />

        <TextField
          label={t('cattle.detail.name')}
          value={name}
          onChangeText={setName}
          testID="edit-name-input"
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button
            variant="secondary"
            label={t('common.cancel')}
            onPress={onClose}
            disabled={submitting}
            testID="edit-btn-cancel"
          />
          <Button
            variant="primary"
            label={t('common.save')}
            onPress={handleSave}
            loading={submitting}
            testID="edit-btn-save"
          />
        </View>
      </View>
    </SheetModal>
  );
}
