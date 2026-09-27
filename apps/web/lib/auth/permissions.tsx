"use client"; // reads the client session cache

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { useSession } from "./use-session";

/** `resource.action` strings from the backend's RBAC catalogue, e.g. "cattle.create". */
export type Permission = string;

const emptySubscribe = () => () => {};

/** True only after hydration — same idiom as `theme-toggle.tsx`'s own private copy. `useCan` below
 * needs it because `useSession()`'s React Query cache is always empty during SSR but can already be
 * warm client-side (carried over from an earlier client-side navigation within the same tab), so
 * `can(...)` could return `false` on the server and `true` on the client's very first paint — a real,
 * reproducible hydration mismatch on every `<Can>`-gated control (found live on `/healthcare`'s
 * "Export"/"Refresh" buttons, RD-081). Gating on `mounted` makes the server and the client's first
 * paint agree (both `false`) — the real permission swaps in a tick later. */
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/** Never compare `role === 'owner'` in components — always gate through this (framework doc 02 §10).
 * The backend's `/auth/me` returns a literal `["*"]` for an Owner (full-access role, verified live
 * RAKHAL-259/260) rather than every individual `resource.action` string — a plain `.includes(...)`
 * check never matched it, silently hiding every `<Can>`-gated control for the Owner account. Fixed
 * at the root (this hook) so every existing/future `<Can I="...">` call site is covered. */
export function useCan() {
  const { data: session } = useSession();
  const mounted = useMounted();
  return (permission: Permission) => {
    if (!mounted || !session) return false;
    const perms = session.permissions;
    // The backend also grants a resource-wide wildcard (`feed.*`) instead of every individual
    // `resource.action` — Manager is seeded this way (permission-catalogue.ts). The backend's own
    // `PermissionService.hasPermission` already treats `${resource}.*` as "every action on that
    // resource" (permission.service.ts:164); this mirrors that rule so `<Can>` agrees with the server
    // instead of silently hiding every control a wildcard-holding role should see.
    const resourceWildcard = `${permission.split(".")[0]}.*`;
    return perms.includes("*") || perms.includes(permission) || perms.includes(resourceWildcard);
  };
}

export function Can({
  I,
  children,
  fallback = null,
}: {
  I: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const can = useCan();
  return can(I) ? <>{children}</> : <>{fallback}</>;
}
