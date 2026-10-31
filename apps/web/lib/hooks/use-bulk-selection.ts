"use client"; // local selection state (table rowSelection / grid Set)

import { useMemo, useState } from "react";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

/** Common shape `BulkActionDock` consumes, regardless of whether the selection lives in a
 * TanStack `RowSelectionState` (table) or a plain `Set<string>` (grid) — see
 * `useTableBulkSelection`/`useGridBulkSelection` below. */
export interface BulkSelectionAdapter {
  selectedIds: string[];
  selectedCount: number;
  isAllSelected: boolean;
  toggleAll: () => void;
  clear: () => void;
}

/** Wraps a `DataTable`'s `RowSelectionState` (lifted to the caller, same as
 * `features/cattle/components/cattle-table.tsx`) into the shared adapter shape. */
export function useTableBulkSelection(
  rowSelection: RowSelectionState,
  setRowSelection: OnChangeFn<RowSelectionState>,
  allIds: string[],
): BulkSelectionAdapter {
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );
  const isAllSelected = allIds.length > 0 && selectedIds.length === allIds.length;

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    isAllSelected,
    toggleAll: () => {
      const next: RowSelectionState = {};
      if (!isAllSelected) allIds.forEach((id) => (next[id] = true));
      setRowSelection(next);
    },
    clear: () => setRowSelection({}),
  };
}

/** Promotes `features/feed/components/feed-view.tsx`'s private `useSectionSelection` (a plain
 * `Set<string>` toggle/selectAll/clear) into a shared hook for grid/card views, which have no
 * TanStack row model to hang a `RowSelectionState` off of. */
export function useGridBulkSelection(
  allIds: string[],
  initialSelected: string[] = [],
): BulkSelectionAdapter & { isSelected: (id: string) => boolean; toggle: (id: string) => void; selectMany: (ids: string[]) => void } {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  return {
    selectedIds: [...selected],
    selectedCount: selected.size,
    isAllSelected,
    isSelected: (id) => selected.has(id),
    toggle: (id) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    selectMany: (ids) => setSelected(new Set(ids)),
    toggleAll: () => setSelected(isAllSelected ? new Set() : new Set(allIds)),
    clear: () => setSelected(new Set()),
  };
}
