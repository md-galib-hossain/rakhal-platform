/**
 * Sheet to create a new animal group (WP9 & Redesign).
 * Strict ADR-007 compliance (zero drop shadows; 1px border separation).
 */
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';

export interface CreateGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: { id: string; name: string; description?: string }) => void;
  testID?: string;
}

export function CreateGroupSheet({
  visible,
  onClose,
  onCreated,
  testID = 'create-group-sheet',
}: CreateGroupSheetProps) {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();
  const { client } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setErrorMsg(null);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, resetForm]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const res = await client.post<{ data?: { id: string; name: string; description?: string }; id?: string; name?: string }>('/animal-groups', {
        name: trimmed,
        description: description.trim() || undefined,
      });
      const data = res?.data?.data ?? res?.data;
      if (data && data.id) {
        onCreated({ id: data.id, name: data.name ?? trimmed, description: description.trim() || undefined });
        resetForm();
        onClose();
      } else {
        setErrorMsg(t('cattle.detail.failedNotice', { time: '' }));
      }
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message ?? t('cattle.detail.failedNotice', { time: '' }));
    } finally {
      setSaving(false);
    }
  }, [client, description, name, onClose, onCreated, resetForm, t]);

  return (
    <SheetModal visible={visible} onRequestClose={onClose} testID={testID}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: tokens.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: tokens.spacing.xs,
        }}
      >
        <SheetTitle>{t('cattle.groups.createTitle')}</SheetTitle>
        <IconButton
          icon="close"
          accessibilityLabel={t('common.close')}
          variant="ghost"
          size="md"
          onPress={onClose}
          testID="create-group-close"
        />
      </View>

      {/* Form */}
      <View style={{ gap: tokens.spacing.sm }}>
        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('cattle.groups.name')} *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('cattle.groups.namePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            testID="create-group-name"
            style={{
              minHeight: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.sm,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
        </View>

        <View style={{ gap: tokens.spacing.xs }}>
          <Text role="label" color="foreground" style={{ fontWeight: '600' }}>
            {t('cattle.groups.description')}
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('cattle.groups.descriptionPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            testID="create-group-description"
            style={{
              minHeight: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.sm,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
        </View>

        {errorMsg ? (
          <Text role="caption" color="destructive" style={{ fontWeight: '600' }}>
            {errorMsg}
          </Text>
        ) : null}
      </View>

      {/* Actions */}
      <View
        style={{
          flexDirection: 'row',
          gap: tokens.spacing.sm,
          paddingTop: tokens.spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button
            label={t('cattle.groups.cancel')}
            variant="secondary"
            size="md"
            onPress={onClose}
            disabled={saving}
            testID="create-group-cancel"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            label={t('cattle.groups.save')}
            variant="primary"
            size="md"
            onPress={handleSave}
            disabled={saving || !name.trim()}
            loading={saving}
            testID="create-group-save"
          />
        </View>
      </View>
    </SheetModal>
  );
}
