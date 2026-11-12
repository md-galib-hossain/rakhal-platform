"use client"; // active-route highlighting needs the client pathname; group collapse is local UI state

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHasFeature } from "@/features/subscription/hooks/use-subscription-gates";
import { navGroups, navItems, type NavGroupKey, type NavItem } from "./nav-items";

export interface SidebarNavProps {
  /** Called after a link is clicked — the mobile Sheet uses this to close itself. */
  onNavigate?: () => void;
}

const COLLAPSED_STORAGE_KEY = "rakhal:sidebar-collapsed-groups";
const COLLAPSED_CHANGE_EVENT = "rakhal:sidebar-collapsed-groups-change";

/** Per-group collapse state lives in localStorage, read via `useSyncExternalStore` (same
 * SSR-safe-external-value pattern as `ThemeToggle`'s `useMounted`/`GlobalSearch`'s `useIsMac`) rather
 * than `useEffect` + `setState`, which React Compiler's lint flags as a cascading-render anti-pattern.
 * A tiny cache keeps `getSnapshot` returning a stable reference between calls (required — a fresh
 * Set every call would make `useSyncExternalStore` think the store changes on every render). */
let cachedRaw: string | null = null;
let cachedSnapshot: Set<NavGroupKey> = new Set();

function readCollapsedGroups(): Set<NavGroupKey> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSnapshot = raw ? new Set(JSON.parse(raw) as NavGroupKey[]) : new Set();
    } catch {
      cachedSnapshot = new Set();
    }
  }
  return cachedSnapshot;
}

function writeCollapsedGroups(next: Set<NavGroupKey>) {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // best-effort — private browsing / storage disabled just means it won't persist
  }
  window.dispatchEvent(new Event(COLLAPSED_CHANGE_EVENT));
}

function subscribeToCollapsedGroups(callback: () => void) {
  window.addEventListener(COLLAPSED_CHANGE_EVENT, callback);
  return () => window.removeEventListener(COLLAPSED_CHANGE_EVENT, callback);
}

const emptyGroupSet = new Set<NavGroupKey>();
function useCollapsedGroups(): Set<NavGroupKey> {
  // Server snapshot is always empty (all expanded) — the real persisted value only exists client-side.
  return useSyncExternalStore(subscribeToCollapsedGroups, readCollapsedGroups, () => emptyGroupSet);
}

function toggleGroup(key: NavGroupKey) {
  const current = readCollapsedGroups();
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  writeCollapsedGroups(next);
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const hasFeature = useHasFeature();
  const Icon = item.icon;
  // Loading (no subscription data yet) reads as locked, same as `useCan()` defaulting closed while
  // session is loading — a brief conservative flash beats a brief false "you have this" flash.
  const locked = item.premiumFlag ? !hasFeature(item.premiumFlag) : false;
  return (
    <Link
      href={locked ? "/subscription" : item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={locked ? t("premiumLocked") : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ease-out select-none",
        "border border-transparent",
        "active:scale-[0.99]",
        "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        active
          ? "border-primary/30 bg-primary/20 text-white shadow-xs shadow-black/10 hover:border-primary/40 hover:bg-primary/25"
          : "text-sidebar-foreground/75 hover:border-white/5 hover:bg-white/10 hover:text-white",
        locked && "opacity-60 hover:opacity-80",
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors duration-150",
          active ? "text-white" : "text-sidebar-foreground/70 group-hover:text-white",
        )}
        aria-hidden
      />
      <span className="truncate">{t(item.labelKey)}</span>
      {item.premiumFlag ? (
        locked ? (
          <Lock
            className={cn(
              "ml-auto size-3.5 shrink-0 transition-colors duration-150",
              active ? "text-white/80" : "text-sidebar-muted/70",
            )}
            aria-hidden
          />
        ) : (
          <span
            className={cn(
              "ml-auto rounded-full px-1.5 py-0.5 text-xs font-semibold uppercase transition-colors duration-150",
              active
                ? "bg-primary/30 text-white"
                : "bg-white/10 text-sidebar-muted group-hover:bg-white/15 group-hover:text-white",
            )}
          >
            Pro
          </span>
        )
      ) : null}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const collapsed = useCollapsedGroups();

  useEffect(() => {
    // Mount-only correction: don't let a group collapsed in a previous session bury the page the
    // user is on right now with no way to orient. Writes straight to the external store (localStorage
    // + a change event) rather than calling a state setter, so this never re-fights a later manual
    // collapse of the same group as the user navigates around.
    const activeItem = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (!activeItem) return;
    const current = readCollapsedGroups();
    if (!current.has(activeItem.group)) return;
    const next = new Set(current);
    next.delete(activeItem.group);
    writeCollapsedGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design, see comment above
  }, []);

  return (
    <nav className="flex flex-1 flex-col gap-3" aria-label={t("groupOverview")}>
      {navGroups.map((group) => {
        const items = navItems.filter((item) => item.group === group.key);
        if (items.length === 0) return null;
        const isCollapsed = collapsed.has(group.key);
        const listId = `sidebar-group-${group.key}`;
        return (
          <div key={group.key} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={!isCollapsed}
              aria-controls={listId}
              className="flex w-full items-center justify-between rounded-md px-4 py-1 text-xs font-bold uppercase tracking-wide text-sidebar-muted transition-colors hover:text-sidebar-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar"
            >
              <span>{t(group.labelKey)}</span>
              <ChevronDown
                className={cn("size-3.5 shrink-0 transition-transform", isCollapsed && "-rotate-90")}
                aria-hidden
              />
            </button>
            {/* Pure-CSS grid-rows collapse (0fr↔1fr) — no JS animation-frame dependency, so it isn't
             * at the mercy of rAF throttling on backgrounded/inactive tabs the way a JS-driven
             * height:"auto" tween would be. Items stay mounted but become unfocusable/hidden from
             * assistive tech while collapsed via `inert`, matching `aria-expanded` on the toggle. */}
            <div
              id={listId}
              inert={isCollapsed || undefined}
              className={cn(
                "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
                isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
              )}
            >
              <div className="flex min-h-0 flex-col gap-1">
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    onNavigate={onNavigate}
                    active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
