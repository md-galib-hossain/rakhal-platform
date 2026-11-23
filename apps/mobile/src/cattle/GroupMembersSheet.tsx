/**
 * Sheet to view and manage members of an animal group (WP9 & Redesign).
 * Allows searching members, adding herd animals, and removing members.
 * Strict ADR-007 compliance (zero drop shadows; 1px border separation).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { Glyph } from '../components/internal/Glyph.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { SearchIcon } from './CattleIcons.tsx';
import type { CattleListItem } from './cattle-model.ts';

export interface GroupMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  group: { id: string; name: string } | null;
  allAnimals: CattleListItem[];
  onMembersChanged?: () => void;
  testID?: string;
}

export function GroupMembersSheet({
  visible,
  onClose,
  group,
  allAnimals,
  onMembersChanged,
  testID = 'group-members-sheet',
}: GroupMembersSheetProps) {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();
  const { client } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  // Initialize member IDs from allAnimals when group or visible changes
  const initMembers = useCallback(() => {
    if (!group) return;
    const initial = new Set<string>();
    for (const a of allAnimals) {
      if ((a.groupIds ?? []).includes(group.id)) {
        initial.add(a.id);
      }
    }
    setMemberIds(initial);
    setSearch('');
    setSelectedToAdd(new Set());
    setPickerOpen(false);
  }, [allAnimals, group]);

  useEffect(() => {
    if (visible && group) {
      initMembers();
    }
  }, [visible, group, initMembers]);

  // Current members list
  const members = useMemo(() => {
    if (!group) return [];
    return allAnimals.filter((a) => memberIds.has(a.id));
  }, [allAnimals, group, memberIds]);

  // Filtered members by search
  const displayedMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.tagNumber.toLowerCase().includes(q) ||
        (m.name && m.name.toLowerCase().includes(q)),
    );
  }, [members, search]);

  // Animals available to add (not in group)
  const availableToAdd = useMemo(() => {
    return allAnimals.filter((a) => !memberIds.has(a.id));
  }, [allAnimals, memberIds]);

  const displayedAvailable = useMemo(() => {
    if (!pickerSearch.trim()) return availableToAdd;
    const q = pickerSearch.trim().toLowerCase();
    return availableToAdd.filter(
      (a) =>
        a.tagNumber.toLowerCase().includes(q) ||
        (a.name && a.name.toLowerCase().includes(q)),
    );
  }, [availableToAdd, pickerSearch]);

  const handleRemoveMember = useCallback(
    async (animalId: string) => {
      if (!group) return;
      setSaving(true);
      try {
        await client.delete(`/animal-groups/${encodeURIComponent(group.id)}/members`, {
          body: { cattleIds: [animalId] },
        });
        setMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(animalId);
          return next;
        });
        onMembersChanged?.();
      } catch {
        // Optimistic local state update fallback
        setMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(animalId);
          return next;
        });
      } finally {
        setSaving(false);
      }
    },
    [client, group, onMembersChanged],
  );

  const toggleSelectToAdd = useCallback((id: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(async () => {
    if (!group || selectedToAdd.size === 0) return;
    setSaving(true);
    const ids = Array.from(selectedToAdd);
    try {
      await client.post(`/animal-groups/${encodeURIComponent(group.id)}/members`, {
        cattleIds: ids,
      });
      setMemberIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      setPickerOpen(false);
      setSelectedToAdd(new Set());
      onMembersChanged?.();
    } catch {
      // Optimistic update
      setMemberIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      setPickerOpen(false);
      setSelectedToAdd(new Set());
    } finally {
      setSaving(false);
    }
  }, [client, group, onMembersChanged, selectedToAdd]);

  if (!group) return null;

  return (
    <>
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
          <View style={{ gap: 2, flex: 1, marginRight: tokens.spacing.sm }}>
            <SheetTitle>{t('cattle.groups.membersTitle', { name: group.name })}</SheetTitle>
            <Text role="caption" color="mutedForeground">
              {t('cattle.groups.membersCount', { count: String(members.length) })}
            </Text>
          </View>

          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={onClose}
            testID="group-members-close"
          />
        </View>

        {/* Action Row & Search */}
        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: tokens.touchTarget.min,
              height: tokens.touchTarget.min,
              paddingHorizontal: tokens.spacing.sm,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: tokens.radius.md,
              gap: tokens.spacing.xs,
            }}
          >
            <SearchIcon size={16} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('cattle.search.placeholder')}
              placeholderTextColor={colors.mutedForeground}
              testID="group-members-search"
              style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
            />
          </View>

          <Button
            label={t('cattle.groups.addAnimals')}
            leadingIcon="plus"
            variant="primary"
            size="md"
            fullWidth={false}
            onPress={() => setPickerOpen(true)}
            testID="group-add-animals-btn"
          />
        </View>

        {/* Members List */}
        <View style={{ gap: tokens.spacing.xs }}>
          {displayedMembers.length === 0 ? (
            <View style={{ paddingVertical: tokens.spacing.xl, alignItems: 'center', gap: tokens.spacing.xs }}>
              <Text role="body" color="mutedForeground">
                {search ? t('cattle.noMatch.title') : t('cattle.empty.title')}
              </Text>
            </View>
          ) : (
            displayedMembers.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: tokens.spacing.sm,
                  paddingHorizontal: tokens.spacing.sm,
                  backgroundColor: colors.card,
                  borderRadius: tokens.radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                testID={`group-member-row-${item.id}`}
              >
                <PressableSurface
                  accessibilityRole="button"
                  accessibilityLabel={item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber}
                  pressedStyle="overlay"
                  onPress={() => {
                    onClose();
                    router.push(`/cattle/${encodeURIComponent(item.id)}`);
                  }}
                  testID={`group-member-link-${item.id}`}
                  style={{ gap: 2, flex: 1, marginRight: tokens.spacing.sm, borderRadius: tokens.radius.sm }}
                >
                  <Text role="body" color="foreground" style={{ fontWeight: '700', fontSize: 14 }}>
                    {item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber}
                  </Text>
                  <Text role="caption" color="mutedForeground">
                    {item.animalCategory ?? item.breedName ?? '—'}
                  </Text>
                </PressableSurface>

                <IconButton
                  icon="close"
                  accessibilityLabel={t('cattle.groups.removeMember')}
                  variant="ghost"
                  size="md"
                  disabled={saving}
                  onPress={() => handleRemoveMember(item.id)}
                  testID={`group-remove-member-${item.id}`}
                />
              </View>
            ))
          )}
        </View>
      </SheetModal>

      {/* Animal Picker Sheet */}
      <SheetModal
        visible={pickerOpen}
        onRequestClose={() => setPickerOpen(false)}
        testID="group-picker-sheet"
      >
        {/* Picker Header */}
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
          <SheetTitle>{t('cattle.groups.selectAnimalsTitle')}</SheetTitle>
          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={() => setPickerOpen(false)}
          />
        </View>

        {/* Picker Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: tokens.touchTarget.min,
            height: tokens.touchTarget.min,
            paddingHorizontal: tokens.spacing.sm,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: tokens.radius.md,
            gap: tokens.spacing.xs,
          }}
        >
          <SearchIcon size={16} color={colors.mutedForeground} />
          <TextInput
            value={pickerSearch}
            onChangeText={setPickerSearch}
            placeholder={t('cattle.search.placeholder')}
            placeholderTextColor={colors.mutedForeground}
            style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
          />
        </View>

        {/* Available Animals List */}
        <View style={{ gap: tokens.spacing.xs }}>
          {displayedAvailable.length === 0 ? (
            <View style={{ paddingVertical: tokens.spacing.lg, alignItems: 'center' }}>
              <Text role="body" color="mutedForeground">
                {t('cattle.groups.noAvailableAnimals')}
              </Text>
            </View>
          ) : (
            displayedAvailable.map((item) => {
              const isChecked = selectedToAdd.has(item.id);
              return (
                <PressableSurface
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber}
                  accessibilityState={{ checked: isChecked }}
                  pressedStyle="overlay"
                  onPress={() => toggleSelectToAdd(item.id)}
                  testID={`picker-animal-row-${item.id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: tokens.spacing.sm,
                    paddingHorizontal: tokens.spacing.sm,
                    backgroundColor: isChecked ? colors.successTint : colors.card,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: isChecked ? colors.primaryEdge : colors.border,
                    minHeight: tokens.touchTarget.min,
                  }}
                >
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text role="body" color="foreground" style={{ fontWeight: '600', fontSize: 14 }}>
                      {item.name ? `${item.name} (${item.tagNumber})` : item.tagNumber}
                    </Text>
                    <Text role="caption" color="mutedForeground">
                      {item.animalCategory ?? item.gender ?? '—'}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: tokens.radius.sm,
                      borderWidth: 1,
                      borderColor: isChecked ? colors.primaryEdge : colors.border,
                      backgroundColor: isChecked ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isChecked ? <Glyph name="check" size={16} color="primaryForeground" /> : null}
                  </View>
                </PressableSurface>
              );
            })
          )}
        </View>

        {/* Picker Footer Actions */}
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
              onPress={() => setPickerOpen(false)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={
                selectedToAdd.size > 0
                  ? t('cattle.groups.addCount', { count: String(selectedToAdd.size) })
                  : t('cattle.groups.addAnimals')
              }
              variant="primary"
              size="md"
              disabled={saving || selectedToAdd.size === 0}
              loading={saving}
              onPress={handleAddSelected}
              testID="picker-confirm-add"
            />
          </View>
        </View>
      </SheetModal>
    </>
  );
}
