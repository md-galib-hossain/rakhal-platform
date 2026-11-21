/**
 * Modal to batch change shed assignment for multiple animals.
 * Strictly adheres to ADR-007 (zero drop shadows, 1px border separation).
 */
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useFormat } from '../i18n/useFormat.ts';
import { useSync } from '../offline/SyncProvider.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export interface BulkChangeShedModalProps {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess: (message: string) => void;
  testID?: string;
}

interface ShedOption {
  id: string;
  name: string;
}

export function BulkChangeShedModal({
  visible,
  onClose,
  selectedIds,
  onSuccess,
  testID = 'bulk-change-shed-modal',
}: BulkChangeShedModalProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const { client } = useAuth();
  const sync = useSync();

  const [sheds, setSheds] = useState<ShedOption[]>([]);
  const [selectedShedId, setSelectedShedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    async function loadSheds() {
      try {
        const rows = await sync.readCache('sheds');
        const parsed: ShedOption[] = [];
        if (Array.isArray(rows)) {
          for (const r of rows) {
            if (!r || typeof r !== 'object') continue;
            const rowRecord = r as Record<string, unknown>;
            const payload = (rowRecord.payload as Record<string, unknown> | undefined) ?? rowRecord;
            const id = typeof payload.id === 'string' ? payload.id : null;
            const name = typeof payload.name === 'string' ? payload.name : null;
            if (id && name) {
              parsed.push({ id, name });
            }
          }
        }
        if (parsed.length > 0 && active) {
          setSheds(parsed);
          setSelectedShedId((prev) => (prev === null ? parsed[0].id : prev));
          return;
        }
      } catch {
        // Cache read error; continue to online fallback
      }

      // Online fallback if cache was empty or uninitialized
      try {
        const res = await client.get<Array<{ id: string; name: string }>>('/sheds');
        const items = Array.isArray(res?.data) ? res.data : [];
        const parsed: ShedOption[] = [];
        for (const item of items) {
          if (item && typeof item.id === 'string' && typeof item.name === 'string') {
            parsed.push({ id: item.id, name: item.name });
          }
        }
        if (active && parsed.length > 0) {
          setSheds(parsed);
          setSelectedShedId((prev) => (prev === null ? parsed[0].id : prev));
        }
      } catch {
        // Ignore fallback failure
      }
    }

    void loadSheds();

    return () => {
      active = false;
    };
  }, [visible, sync, client]);

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
        action: 'change_shed',
        cattleIds: selectedIds,
        payload: { shedId: selectedShedId ?? undefined },
      });

      const targetShed = sheds.find((s) => s.id === selectedShedId);
      const shedName = targetShed ? targetShed.name : t('cattle.bulk.shed.noShed');
      const msg = t('cattle.bulk.shed.success', {
        count: format.numberSafe(selectedIds.length),
        shed: shedName,
      });

      handleClose();
      onSuccess(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cattle.bulk.shed.error');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
          {t('cattle.bulk.shed.title', { count: format.numberSafe(selectedIds.length) })}
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

        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('cattle.bulk.shed.selectShed')}
          </Text>

          <View style={{ gap: tokens.spacing.xs }}>
            {sheds.map((shed) => {
              const active = selectedShedId === shed.id;
              return (
                <PressableSurface
                  key={shed.id}
                  accessibilityRole="button"
                  accessibilityLabel={shed.name}
                  pressedStyle="overlay"
                  onPress={() => setSelectedShedId(shed.id)}
                  testID={`bulk-shed-option-${shed.id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                    minHeight: tokens.touchTarget.min,
                    borderRadius: tokens.radius.md,
                    backgroundColor: active ? colors.successTint : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.primaryEdge : colors.border,
                  }}
                >
                  <Text
                    role="label"
                    color={active ? 'primary' : 'foreground'}
                    style={{ fontWeight: active ? '700' : '500', fontSize: 14 }}
                  >
                    {shed.name}
                  </Text>
                  {active ? <Glyph name="check" size={16} color="primary" /> : null}
                </PressableSurface>
              );
            })}

            {/* Unassign option */}
            <PressableSurface
              accessibilityRole="button"
              accessibilityLabel={t('cattle.bulk.shed.noShed')}
              pressedStyle="overlay"
              onPress={() => setSelectedShedId(null)}
              testID="bulk-shed-option-none"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.sm,
                minHeight: tokens.touchTarget.min,
                borderRadius: tokens.radius.md,
                backgroundColor: selectedShedId === null ? colors.muted : colors.card,
                borderWidth: 1,
                borderColor: selectedShedId === null ? colors.primaryEdge : colors.border,
              }}
            >
              <Text
                role="label"
                color="mutedForeground"
                style={{ fontWeight: selectedShedId === null ? '700' : '500', fontSize: 14 }}
              >
                {t('cattle.bulk.shed.noShed')}
              </Text>
              {selectedShedId === null ? <Glyph name="check" size={16} color="foreground" /> : null}
            </PressableSurface>
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
                  ? t('cattle.bulk.shed.submitting')
                  : t('cattle.bulk.shed.submit', { count: format.numberSafe(selectedIds.length) })
              }
              variant="primary"
              size="md"
              fullWidth
              onPress={handleSubmit}
              disabled={submitting}
              testID="bulk-shed-submit-btn"
            />
          </View>
        </View>
      </ScrollView>
    </SheetModal>
  );
}
