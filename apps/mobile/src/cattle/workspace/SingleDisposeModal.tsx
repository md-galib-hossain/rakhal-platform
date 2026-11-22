/**
 * SingleDisposeModal: Modal to dispose an individual animal (Sale, Cull, Deceased).
 * Strictly zero drop shadows (ADR-007 compliant).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider.tsx';
import { Button } from '../../components/actions/Button.tsx';
import { TextField } from '../../components/forms/TextField.tsx';
import { PressableSurface } from '../../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../../components/internal/SheetModal.tsx';
import { Text } from '../../components/primitives/Text.tsx';
import { useLocale } from '../../providers/LocaleProvider.tsx';
import { useTheme } from '../../providers/ThemeProvider.tsx';
import { radius } from '../../theme/tokens.ts';
import type { CattleDetail } from '../cattle-detail-model.ts';

export interface SingleDisposeModalProps {
  visible: boolean;
  onClose: () => void;
  detail: CattleDetail;
  onSuccess: (message: string) => void;
  testID?: string;
}

type DisposeType = 'SALE' | 'CULL' | 'DEATH';

export function SingleDisposeModal({
  visible,
  onClose,
  detail,
  onSuccess,
  testID = 'single-dispose-modal',
}: SingleDisposeModalProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const { client } = useAuth();

  const [disposeType, setDisposeType] = useState<DisposeType>('SALE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await client.post(`/cattle/${encodeURIComponent(detail.id)}/dispose`, {
        type: disposeType,
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      });
      onSuccess(t('cattle.workspace.disposeSuccess'));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not dispose animal');
    } finally {
      setSubmitting(false);
    }
  };

  const types: { key: DisposeType; label: string }[] = [
    { key: 'SALE', label: t('cattle.workspace.dispose') },
    { key: 'CULL', label: t('cattle.workspace.dispose') },
    { key: 'DEATH', label: t('cattle.workspace.dispose') },
  ];

  return (
    <SheetModal visible={visible} onRequestClose={onClose} heightFraction={0.65} testID={testID}>
      <View style={{ gap: 14 }}>
        <SheetTitle>{t('cattle.workspace.disposeTitle')}</SheetTitle>
        <Text role="body" style={{ color: colors.mutedForeground }}>
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

        {/* Dispose Type Options */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {types.map((type) => {
            const isSelected = disposeType === type.key;
            return (
              <PressableSurface
                key={type.key}
                accessibilityRole="button"
                pressedStyle="overlay"
                testID={`dispose-type-${type.key.toLowerCase()}`}
                onPress={() => setDisposeType(type.key)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  role="body"
                  style={{
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? colors.primaryForeground : colors.foreground,
                  }}
                >
                  {type.key}
                </Text>
              </PressableSurface>
            );
          })}
        </View>

        {/* Notes input */}
        <TextField
          label={t('cattle.detail.name')}
          value={notes}
          onChangeText={setNotes}
          testID="dispose-notes-input"
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Button
            variant="secondary"
            label={t('common.cancel')}
            onPress={onClose}
            disabled={submitting}
            testID="dispose-btn-cancel"
          />
          <Button
            variant="primary"
            label={t('cattle.workspace.dispose')}
            onPress={handleSubmit}
            loading={submitting}
            testID="dispose-btn-submit"
          />
        </View>
      </View>
    </SheetModal>
  );
}
