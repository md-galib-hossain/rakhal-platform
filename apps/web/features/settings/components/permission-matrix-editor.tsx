"use client"; // controlled checkbox grid

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@rakhal/ui/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PermissionCatalogueEntry, PermissionMatrix } from "../types";

/**
 * Module x action grant grid (RFE-101).
 *
 * Driven entirely by the catalogue the backend ships alongside the roles list — never a
 * hardcoded permission list, so a permission added to `permission-catalogue.ts` appears here
 * without a frontend change.
 *
 * Grants are held as concrete `resource.action` keys. The backend also accepts wildcards
 * (`*`, `resource.*`) and expands them into the `matrix` it returns, which is why the Owner
 * role arrives with every box ticked from a single stored `*`. This editor always *writes*
 * concrete keys, so ticking every box for a resource does not silently become a wildcard.
 */
export function PermissionMatrixEditor({
  catalogue,
  selectedKeys,
  onChange,
  readOnly = false,
}: {
  catalogue: PermissionCatalogueEntry[];
  selectedKeys: Set<string>;
  onChange?: (next: Set<string>) => void;
  readOnly?: boolean;
}) {
  const t = useTranslations("settings.roles");

  /** Group the resources so the grid reads as sections rather than one long list. */
  const groups = useMemo(() => {
    const byGroup = new Map<string, PermissionCatalogueEntry[]>();
    for (const entry of catalogue) {
      const list = byGroup.get(entry.group) ?? [];
      list.push(entry);
      byGroup.set(entry.group, list);
    }
    return [...byGroup.entries()].map(([group, resources]) => ({
      group,
      resources: [...resources].sort((a, b) => a.resource.localeCompare(b.resource)),
    }));
  }, [catalogue]);

  function toggle(key: string, granted: boolean) {
    if (readOnly || !onChange) return;
    const next = new Set(selectedKeys);
    if (granted) next.add(key);
    else next.delete(key);
    onChange(next);
  }

  function toggleResource(entry: PermissionCatalogueEntry, granted: boolean) {
    if (readOnly || !onChange) return;
    const next = new Set(selectedKeys);
    for (const action of entry.actions) {
      const key = `${entry.resource}.${action}`;
      if (granted) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  }

  if (catalogue.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noPermissions")}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map(({ group, resources }) => (
        <section key={group} className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {group.replace(/_/g, " ").toLowerCase()}
          </h4>

          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {resources.map((entry) => {
              const all = entry.actions.every((a) => selectedKeys.has(`${entry.resource}.${a}`));
              const some = entry.actions.some((a) => selectedKeys.has(`${entry.resource}.${a}`));

              return (
                <div
                  key={entry.resource}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
                >
                  <label
                    className={cn(
                      "flex min-w-44 items-center gap-2 text-sm font-medium text-foreground",
                      readOnly ? "cursor-default" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      checked={all ? true : some ? "indeterminate" : false}
                      disabled={readOnly}
                      onCheckedChange={(v) => toggleResource(entry, v === true)}
                      aria-label={t("toggleResource", { resource: entry.resource })}
                    />
                    <span className="capitalize">{entry.resource.replace(/-/g, " ")}</span>
                  </label>

                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {entry.actions.map((action) => {
                      const key = `${entry.resource}.${action}`;
                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex items-center gap-1.5 text-sm text-muted-foreground",
                            readOnly ? "cursor-default" : "cursor-pointer",
                          )}
                        >
                          <Checkbox
                            checked={selectedKeys.has(key)}
                            disabled={readOnly}
                            onCheckedChange={(v) => toggle(key, v === true)}
                            aria-label={key}
                          />
                          <span>{action.replace(/-/g, " ")}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Flatten a role's expanded `matrix` back into the concrete keys the editor works with. */
export function matrixToKeys(matrix: PermissionMatrix): Set<string> {
  const keys = new Set<string>();
  for (const [resource, actions] of Object.entries(matrix)) {
    for (const [action, granted] of Object.entries(actions)) {
      if (granted) keys.add(`${resource}.${action}`);
    }
  }
  return keys;
}
