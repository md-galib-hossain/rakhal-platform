/**
 * Cattle tab body (WP9). Gated by the same permission the tab bar uses (`cattle.read`, from the nav config) so a deep
 * link cannot reach the list without it. Read only: tapping an animal opens its detail. No write actions exist yet.
 */
import { router } from 'expo-router';
import { useCallback } from 'react';
import { TABS } from '../navigation/nav-config.ts';
import { PermissionGate } from '../permissions/PermissionGate.tsx';
import { CattleList } from './CattleList.tsx';
import type { CattleListItem } from './cattle-model.ts';

const CATTLE_PERMISSION = TABS.find((tab) => tab.key === 'cattle')?.permission ?? 'cattle.read';

export function CattleListScreen() {
  const open = useCallback((item: CattleListItem) => router.push({ pathname: '/cattle/[id]', params: { id: item.id } }), []);
  return (
    <PermissionGate permission={CATTLE_PERMISSION}>
      <CattleList onSelect={open} testID="screen-cattle" />
    </PermissionGate>
  );
}
