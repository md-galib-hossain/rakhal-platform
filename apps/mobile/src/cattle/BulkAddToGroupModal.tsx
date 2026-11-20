/**
 * Modal to batch add multiple animals to an animal group.
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
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { useAnimalGroups } from './useAnimalGroups.ts';

export interface BulkAddToGroupModalProps {
  visible: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess: (message: string) => void;
  testID?: string;
}

export function BulkAddToGroupModal({
  visible,
  onClose,
  selectedIds,
  onSuccess,
  testID = 'bulk-add-to-group-modal',
}: BulkAddToGroupModalProps) {
  const { colors, tokens } = useTheme();
  const { t } = useLocale();
  const format = useFormat();
  const { client } = useAuth();
  const { groups, reload } = useAnimalGroups();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      void reload();
      if (groups.length > 0 && selectedGroupId === null) {
        setSelectedGroupId(groups[0].id);
      }
    }
  }, [visible, reload, groups, selectedGroupId]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedGroupId || selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await client.post<{
        added?: number;
        group?: { id: string; name: string };
        name?: string;
      }>(`/animal-groups/${encodeURIComponent(selectedGroupId)}/members`, {
        cattleIds: selectedIds,
      });

      const targetGroup = groups.find((g) => g.id === selectedGroupId);
      const groupName = targetGroup?.name ?? res?.data?.name ?? 'Group';
      const addedCount = res?.data?.added ?? selectedIds.length;
      const msg = t('cattle.bulk.group.success', {
        name: groupName,
        added: format.numberSafe(addedCount),
      });

      handleClose();
      onSuccess(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cattle.bulk.group.error');
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
          {t('cattle.bulk.group.title', { count: format.numberSafe(selectedIds.length) })}
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
            {t('cattle.bulk.group.selectGroup')}
          </Text>

          {groups.length === 0 ? (
            <Text role="body" color="mutedForeground" style={{ fontStyle: 'italic', paddingVertical: tokens.spacing.sm }}>
              {t('cattle.groups.empty')}
            </Text>
          ) : (
            <View style={{ gap: tokens.spacing.xs }}>
              {groups.map((grp) => {
                const active = selectedGroupId === grp.id;
                return (
                  <PressableSurface
                    key={grp.id}
                    accessibilityRole="button"
                    accessibilityLabel={grp.name}
                    pressedStyle="overlay"
                    onPress={() => setSelectedGroupId(grp.id)}
                    testID={`bulk-group-option-${grp.id}`}
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
                    <View style={{ gap: 2 }}>
                      <Text
                        role="label"
                        color={active ? 'primary' : 'foreground'}
                        style={{ fontWeight: active ? '700' : '500', fontSize: 14 }}
                      >
                        {grp.name}
                      </Text>
                      <Text role="caption" color="mutedForeground" style={{ fontSize: 12 }}>
                        {t('cattle.groups.membersCount', { count: format.numberSafe(grp.memberCount ?? 0) })}
                      </Text>
                    </View>
                    {active ? <Glyph name="check" size={16} color="primary" /> : null}
                  </PressableSurface>
                );
              })}
            </View>
          )}
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
                  ? t('cattle.bulk.group.submitting')
                  : t('cattle.bulk.group.submit', { count: format.numberSafe(selectedIds.length) })
              }
              variant="primary"
              size="md"
              fullWidth
              onPress={handleSubmit}
              disabled={submitting || !selectedGroupId}
              testID="bulk-group-submit-btn"
            />
          </View>
        </View>
      </ScrollView>
    </SheetModal>
  );
}
