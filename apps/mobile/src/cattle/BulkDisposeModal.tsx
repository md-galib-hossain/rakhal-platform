/**
 * Modal to batch dispose multiple animals (Sold, Culled, Deceased).
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation).
 */
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export interface BulkDisposeModalProps {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess: (message: string) => void;
  testID?: string;
}

type DisposeType = 'SALE' | 'CULL' | 'DEATH';

export function BulkDisposeModal({
  visible,
  onClose,
  selectedIds,
  onSuccess,
  testID = 'bulk-dispose-modal',
}: BulkDisposeModalProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const { client } = useAuth();

  const [disposeType, setDisposeType] = useState<DisposeType>('SALE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      await client.post('/cattle/bulk', {
        action: 'dispose',
        cattleIds: selectedIds,
        payload: { type: disposeType },
      });

      const msg = t('cattle.bulk.dispose.success', {
        count: format.numberSafe(selectedIds.length),
      });

      handleClose();
      onSuccess(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cattle.bulk.dispose.error');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const options: { type: DisposeType; label: string; desc: string }[] = [
    {
      type: 'SALE',
      label: t('cattle.bulk.dispose.type.sale'),
      desc: 'Animal sold to customer or market',
    },
    {
      type: 'CULL',
      label: t('cattle.bulk.dispose.type.cull'),
      desc: 'Removed due to age, low production, or health',
    },
    {
      type: 'DEATH',
      label: t('cattle.bulk.dispose.type.death'),
      desc: 'Mortality / deceased animal',
    },
  ];

  if (!visible) return null;

  return (
    <SheetModal visible={visible} onRequestClose={handleClose} testID={testID}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
        }}
      >
        <SheetTitle>
          {t('cattle.bulk.dispose.title', { count: format.numberSafe(selectedIds.length) })}
        </SheetTitle>
        <PressableSurface
          accessibilityRole="button"
          accessibilityLabel={t('cattle.bulk.cancel')}
          pressedStyle="overlay"
          onPress={handleClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: tokens.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.muted,
          }}
        >
          <Glyph name="close" size={16} color="foreground" />
        </PressableSurface>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}
      >
        {error ? (
          <View
            style={{
              padding: tokens.spacing.sm,
              borderRadius: tokens.radius.sm,
              backgroundColor: colors.destructiveTint,
              borderWidth: 1,
              borderColor: colors.destructive,
            }}
          >
            <Text role="caption" color="destructiveText">
              {error}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            padding: tokens.spacing.sm,
            borderRadius: tokens.radius.sm,
            backgroundColor: colors.warningTint,
            borderWidth: 1,
            borderColor: colors.warning,
          }}
        >
          <Text role="caption" color="warningText">
            {t('cattle.bulk.dispose.description')}
          </Text>
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('cattle.bulk.dispose.type')}
          </Text>

          <View style={{ gap: tokens.spacing.xs }}>
            {options.map((opt) => {
              const active = disposeType === opt.type;
              return (
                <PressableSurface
                  key={opt.type}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  pressedStyle="overlay"
                  onPress={() => setDisposeType(opt.type)}
                  testID={`bulk-dispose-option-${opt.type}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                    minHeight: tokens.touchTarget.min,
                    borderRadius: tokens.radius.md,
                    backgroundColor: active ? colors.destructiveTint : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.destructive : colors.border,
                  }}
                >
                  <View style={{ gap: 2 }}>
                    <Text
                      role="label"
                      color={active ? 'destructiveText' : 'foreground'}
                      style={{ fontWeight: active ? '700' : '500', fontSize: 14 }}
                    >
                      {opt.label}
                    </Text>
                    <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                      {opt.desc}
                    </Text>
                  </View>
                  {active ? <Glyph name="check" size={16} color="destructiveText" /> : null}
                </PressableSurface>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label={t('cattle.bulk.cancel')}
              variant="secondary"
              size="md"
              fullWidth
              onPress={handleClose}
              disabled={submitting}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              label={
                submitting
                  ? t('cattle.bulk.dispose.submitting')
                  : t('cattle.bulk.dispose.submit')
              }
              variant="destructive"
              size="md"
              fullWidth
              onPress={handleSubmit}
              disabled={submitting}
              testID="bulk-dispose-submit-btn"
            />
          </View>
        </View>
      </ScrollView>
    </SheetModal>
  );
}
