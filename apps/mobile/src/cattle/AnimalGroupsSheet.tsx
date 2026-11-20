/**
 * Animal Groups Drawer/Sheet (WP9 & Redesign).
 * Lists all animal groups with member counts.
 * Allows filtering the active herd list, creating new groups, and viewing/managing members.
 * Strict ADR-007 compliance (zero drop shadows; 1px border separation).
 */
import { useCallback, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '../components/actions/Button.tsx';
import { IconButton } from '../components/actions/IconButton.tsx';
import { PressableSurface } from '../components/internal/PressableSurface.tsx';
import { SheetModal, SheetTitle } from '../components/internal/SheetModal.tsx';
import { Text } from '../components/primitives/Text.tsx';
import { useLocale } from '../providers/LocaleProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { AnimalGroupOption } from './CattleFilterSheet.tsx';
import { SearchIcon, UsersIcon } from './CattleIcons.tsx';
import { CreateGroupSheet } from './CreateGroupSheet.tsx';
import { GroupMembersSheet } from './GroupMembersSheet.tsx';
import type { CattleListItem } from './cattle-model.ts';

export interface AnimalGroupsSheetProps {
  visible: boolean;
  onClose: () => void;
  allAnimals: CattleListItem[];
  activeGroupId?: string | null;
  onFilterByGroup: (groupId: string | null, groupName?: string) => void;
  groups: AnimalGroupOption[];
  onRefreshGroups?: () => void;
  testID?: string;
}

export function AnimalGroupsSheet({
  visible,
  onClose,
  allAnimals,
  activeGroupId,
  onFilterByGroup,
  groups,
  onRefreshGroups,
  testID = 'animal-groups-sheet',
}: AnimalGroupsSheetProps) {
  const { t } = useLocale();
  const { colors, tokens } = useTheme();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [managingGroup, setManagingGroup] = useState<AnimalGroupOption | null>(null);

  const displayedGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  const handleCreated = useCallback(
    () => {
      onRefreshGroups?.();
    },
    [onRefreshGroups],
  );

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs, flex: 1 }}>
            <UsersIcon size={20} color={colors.primary} />
            <SheetTitle>{t('cattle.groups.title')}</SheetTitle>
          </View>

          <IconButton
            icon="close"
            accessibilityLabel={t('common.close')}
            variant="ghost"
            size="md"
            onPress={onClose}
            testID="animal-groups-close"
          />
        </View>

        {/* Action Row & Search */}
        <View style={{ flexDirection: 'row', gap: tokens.spacing.sm, alignItems: 'center' }}>
          {/* Search Box */}
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
              placeholder={t('cattle.groups.search')}
              placeholderTextColor={colors.mutedForeground}
              testID="animal-groups-search"
              style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
            />
          </View>

          {/* Create Group Button */}
          <Button
            label={t('cattle.groups.create')}
            leadingIcon="plus"
            variant="primary"
            size="md"
            fullWidth={false}
            onPress={() => setCreateOpen(true)}
            testID="animal-groups-create-btn"
          />
        </View>

        {/* Groups List */}
        <View style={{ gap: tokens.spacing.sm }}>
          {displayedGroups.length === 0 ? (
            <View style={{ paddingVertical: tokens.spacing.xl, alignItems: 'center', gap: tokens.spacing.xs }}>
              <Text role="body" color="mutedForeground">
                {search ? t('cattle.groups.noMatch', { query: search }) : t('cattle.groups.empty')}
              </Text>
            </View>
          ) : (
            displayedGroups.map((item) => {
              const isActive = activeGroupId === item.id;
              const herdCount = allAnimals.filter((a) => (a.groupIds ?? []).includes(item.id)).length;
              const displayCount = item.memberCount ?? herdCount;

              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: isActive ? colors.successTint : colors.card,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primaryEdge : colors.border,
                    padding: tokens.spacing.md,
                    gap: tokens.spacing.sm,
                  }}
                  testID={`animal-group-card-${item.id}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text role="title" color="foreground" style={{ fontWeight: '700', fontSize: 15 }}>
                        {item.name}
                      </Text>
                      <Text role="caption" color="mutedForeground">
                        {t('cattle.groups.membersCount', { count: String(displayCount) })}
                      </Text>
                    </View>

                    {isActive ? (
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: tokens.radius.full,
                        }}
                      >
                        <Text role="caption" color="primaryForeground" style={{ fontWeight: '700', fontSize: 11 }}>
                          ACTIVE
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions Row */}
                  <View style={{ flexDirection: 'row', gap: tokens.spacing.xs, justifyContent: 'flex-end', marginTop: 4 }}>
                    <PressableSurface
                      accessibilityRole="button"
                      accessibilityLabel={t('cattle.groups.viewMembers')}
                      pressedStyle="overlay"
                      onPress={() => setManagingGroup(item)}
                      testID={`animal-group-members-btn-${item.id}`}
                      style={{
                        paddingHorizontal: tokens.spacing.sm,
                        paddingVertical: tokens.spacing.xs,
                        borderRadius: tokens.radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text role="caption" color="foreground" style={{ fontWeight: '600', fontSize: 12 }}>
                        {t('cattle.groups.viewMembers')}
                      </Text>
                    </PressableSurface>

                    <PressableSurface
                      accessibilityRole="button"
                      accessibilityLabel={isActive ? t('cattle.filters.clearAll') : t('cattle.groups.filterByGroup')}
                      pressedStyle={isActive ? 'overlay' : { fill: 'primaryHover' }}
                      onPress={() => {
                        if (isActive) {
                          onFilterByGroup(null);
                        } else {
                          onFilterByGroup(item.id, item.name);
                        }
                        onClose();
                      }}
                      testID={`animal-group-filter-btn-${item.id}`}
                      style={{
                        paddingHorizontal: tokens.spacing.sm,
                        paddingVertical: tokens.spacing.xs,
                        borderRadius: tokens.radius.sm,
                        backgroundColor: isActive ? colors.secondary : colors.primary,
                        borderWidth: 1,
                        borderColor: isActive ? colors.border : colors.primary,
                      }}
                    >
                      <Text
                        role="caption"
                        color={isActive ? 'foreground' : 'primaryForeground'}
                        style={{ fontWeight: '700', fontSize: 12 }}
                      >
                        {isActive ? t('cattle.filters.clearAll') : t('cattle.groups.filterByGroup')}
                      </Text>
                    </PressableSurface>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </SheetModal>

      {/* Create Group Sheet */}
      <CreateGroupSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {/* Group Members Sheet */}
      <GroupMembersSheet
        visible={managingGroup !== null}
        onClose={() => setManagingGroup(null)}
        group={managingGroup}
        allAnimals={allAnimals}
        onMembersChanged={onRefreshGroups}
      />
    </>
  );
}
