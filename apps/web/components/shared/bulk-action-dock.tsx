"use client"; // portals a fixed bottom-center bar, owns its own confirm-dialog state

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export interface BulkAction {
  key: string;
  label: string;
  variant?: "primary" | "outline" | "destructive";
  /** Opens a `ConfirmDialog` before calling `onRun` — for a plain "open my own dialog" action
   * (e.g. Cattle's change-shed/feed-group pickers), omit this and let `onRun` do that instead;
   * the dock stays a dumb rendering shell either way, never a dialog-orchestration engine. */
  requiresConfirm?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  onRun: (ids: string[]) => void | Promise<void>;
}

export interface BulkActionDockProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onCancel: () => void;
  actions: BulkAction[];
  selectedIds: string[];
  selectAllLabel: string;
  cancelLabel: string;
  selectedCountLabel: string;
}

/** Floating bulk-select action bar (2026-07-21) — bottom-center, appears only once ≥1 row/card is
 * selected, shared across every list view instead of each feature hand-rolling its own inline bar
 * (`cattle-bulk-actions-bar.tsx`, `feed-bulk-actions-bar.tsx` predate this and stay inline for now
 * — this pilot only wires Inventory's 4 tabs into the new floating pattern). Portaled to
 * `document.body` so no ancestor's `overflow`/`transform` can ever clip or reposition it; enter
 * animation only, instant unmount on exit (matches both existing inline bars' current behavior). */
export function BulkActionDock({
  selectedCount,
  totalCount,
  onSelectAll,
  onCancel,
  actions,
  selectedIds,
  selectAllLabel,
  cancelLabel,
  selectedCountLabel,
}: BulkActionDockProps) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  if (selectedCount === 0 || typeof document === "undefined") return null;

  const confirmAction = actions.find((a) => a.key === confirmKey);

  async function run(action: BulkAction) {
    await action.onRun(selectedIds);
    setConfirmKey(null);
  }

  return createPortal(
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-4 duration-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">{selectedCountLabel}</p>
        {selectedCount < totalCount ? (
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            {selectAllLabel}
          </Button>
        ) : null}
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? "destructive"}
            size="sm"
            onClick={() => (action.requiresConfirm ? setConfirmKey(action.key) : run(action))}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>

      {confirmAction ? (
        <ConfirmDialog
          open={Boolean(confirmAction)}
          onOpenChange={(open) => !open && setConfirmKey(null)}
          title={confirmAction.confirmTitle ?? confirmAction.label}
          description={confirmAction.confirmDescription}
          confirmLabel={confirmAction.confirmLabel ?? confirmAction.label}
          cancelLabel={cancelLabel}
          onConfirm={() => run(confirmAction)}
        />
      ) : null}
    </div>,
    document.body,
  );
}
