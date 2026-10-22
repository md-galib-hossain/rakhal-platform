"use client"; // manages open state + a pending mutation click

import { useState } from "react";
import { ArrowRightToLine } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Defaults to "Confirm" / destructive styling; pass overrides for non-destructive confirmations. */
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary";
  onConfirm: () => void | Promise<void>;
}

/** Destructive-action confirmation (archive cattle, void txn, delete shed) — never an instant mutation. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-md sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{title}</SheetTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={cancelLabel}
            className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex-1 py-4">{description ? <SheetDescription>{description}</SheetDescription> : null}</div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={variant} className="h-12 flex-1" onClick={handleConfirm} disabled={pending}>
            {pending ? "…" : confirmLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
