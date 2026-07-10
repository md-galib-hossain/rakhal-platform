"use client"; // reads the client session cache

import type { ReactNode } from "react";
import { useSession } from "./use-session";

/** `resource.action` strings from the backend's RBAC catalogue, e.g. "cattle.create". */
export type Permission = string;

/** Never compare `role === 'owner'` in components — always gate through this (framework doc 02 §10). */
export function useCan() {
  const { data: session } = useSession();
  return (permission: Permission) => session?.permissions.includes(permission) ?? false;
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
