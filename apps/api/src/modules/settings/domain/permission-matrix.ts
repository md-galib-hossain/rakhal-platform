import { PermissionGroup } from '@prisma/client';
import { PERMISSIONS } from 'src/modules/permission/domain/permission-catalogue';

/**
 * Pure helpers for the role/permission editor (RAKHAL-031).
 *
 * The RBAC catalogue (`permission-catalogue.ts`) is the single source of truth.
 * Stored grants may include the global wildcard `*`, a resource wildcard
 * `resource.*`, or exact `resource.action` keys — exactly what the guard matcher
 * (`PermissionService.matchesPermission`) understands. These helpers group the
 * catalogue for display and expand wildcard grants into the effective set of
 * concrete actions so the UI can render a per-action matrix.
 */

export interface ResourcePermissions {
  /** Permission group the resource belongs to (e.g. `CATTLE`). */
  group: PermissionGroup;
  /** Resource segment of the key (e.g. `cattle`). */
  resource: string;
  /** Concrete actions available for the resource (e.g. `['read','create',…]`). */
  actions: string[];
}

/** Catalogue grouped by resource, wildcards excluded — drives the editor grid. */
export function buildCatalogue(): ResourcePermissions[] {
  const byResource = new Map<string, ResourcePermissions>();

  for (const perm of PERMISSIONS) {
    if (perm.key === '*' || perm.key.endsWith('.*')) continue;
    const [resource, action] = perm.key.split('.');
    if (!resource || !action) continue;

    let entry = byResource.get(resource);
    if (!entry) {
      entry = { group: perm.group, resource, actions: [] };
      byResource.set(resource, entry);
    }
    if (!entry.actions.includes(action)) entry.actions.push(action);
  }

  return [...byResource.values()];
}

/** Every concrete (non-wildcard) `resource.action` key in the catalogue. */
export function concreteKeys(): string[] {
  return PERMISSIONS.map((p) => p.key).filter(
    (k) => k !== '*' && !k.endsWith('.*'),
  );
}

/** Every valid grantable key (concrete + `resource.*` + `*`). */
export function allGrantableKeys(): Set<string> {
  return new Set(PERMISSIONS.map((p) => p.key));
}

/**
 * Expand a set of stored grants into the effective concrete keys.
 * `*` grants everything; `resource.*` grants every action of that resource.
 */
export function expandGrants(grantedKeys: string[]): Set<string> {
  const granted = new Set(grantedKeys);
  const effective = new Set<string>();

  for (const key of concreteKeys()) {
    const [resource] = key.split('.');
    if (granted.has('*') || granted.has(`${resource}.*`) || granted.has(key)) {
      effective.add(key);
    }
  }
  return effective;
}

/** A `resource → action → granted` matrix for display, from stored grants. */
export function toMatrix(
  grantedKeys: string[],
): Record<string, Record<string, boolean>> {
  const effective = expandGrants(grantedKeys);
  const matrix: Record<string, Record<string, boolean>> = {};

  for (const { resource, actions } of buildCatalogue()) {
    matrix[resource] = {};
    for (const action of actions) {
      matrix[resource][action] = effective.has(`${resource}.${action}`);
    }
  }
  return matrix;
}

/** Validate keys against the catalogue; returns the unknown ones. */
export function invalidKeys(keys: string[]): string[] {
  const valid = allGrantableKeys();
  return keys.filter((k) => !valid.has(k));
}
