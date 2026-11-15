/**
 * Navigation config (WP6): the one place that says which bottom tabs exist, in which order, and which permission a
 * tab needs (PRD 6.3: Home | Cattle | Milk | Tasks | More). Pure: node --test imports it.
 *
 * A tab with `permission: null` is always shown. Permission keys are the API's (`cattle.read`, `milk.read`,
 * `task.read`), matched through `can` so `*` and `resource.*` work. The same config drives the tab bar and the
 * screen-level `PermissionGate`, so a worker without a permission sees no tab AND cannot reach the screen by a deep link.
 */
import type { MessageKey } from '../i18n/messages.ts';
import { can, type Permission } from '../permissions/can.ts';

export type TabKey = 'home' | 'cattle' | 'milk' | 'tasks' | 'more';

export interface TabConfig {
  key: TabKey;
  /** expo-router route name inside `app/(tabs)` (`index` is Home). */
  routeName: string;
  /** Absolute path used for navigation and for restoring the last tab. */
  href: '/' | '/cattle' | '/milk' | '/tasks' | '/more';
  labelKey: MessageKey;
  permission: Permission | null;
}

export const TABS: readonly TabConfig[] = [
  { key: 'home', routeName: 'index', href: '/', labelKey: 'nav.home', permission: null },
  { key: 'cattle', routeName: 'cattle', href: '/cattle', labelKey: 'nav.cattle', permission: 'cattle.read' },
  { key: 'milk', routeName: 'milk', href: '/milk', labelKey: 'nav.milk', permission: 'milk.read' },
  { key: 'tasks', routeName: 'tasks', href: '/tasks', labelKey: 'nav.tasks', permission: 'task.read' },
  { key: 'more', routeName: 'more', href: '/more', labelKey: 'nav.more', permission: null },
];

/** Tabs the account may see, in config order. `granted` null/undefined means permissions are not known yet. */
export function visibleTabs(granted: readonly Permission[] | null | undefined): TabConfig[] {
  return TABS.filter((tab) => can(granted, tab.permission));
}

export function tabByHref(href: string): TabConfig | undefined {
  return TABS.find((tab) => tab.href === href);
}

export const DEFAULT_TAB: TabConfig = TABS[0] as TabConfig;

/** Where to land on relaunch: the stored tab when it still exists and is permitted, else Home. */
export function resolveStartTab(stored: string | null | undefined, granted: readonly Permission[] | null | undefined): TabConfig {
  const tab = stored ? tabByHref(stored) : undefined;
  return tab && can(granted, tab.permission) ? tab : DEFAULT_TAB;
}
